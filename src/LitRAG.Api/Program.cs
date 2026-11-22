using LitRAG.Api;
using LitRAG.Core;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;

AppContext.SetSwitch("System.Net.Http.SocketsHttpHandler.Http2UnencryptedSupport", true);
DotNetEnv.Env.TraversePath().Load();
var builder = WebApplication.CreateBuilder(args);

string researchDocsDir = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "research-docs"));
Directory.CreateDirectory(researchDocsDir);

builder.Services.AddSingleton(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var host = config["Qdrant:Host"] ?? "localhost";
            var port = config.GetValue("Qdrant:Port", 6334);
            return new VectorDB(host, port);
        });

builder.Services.AddSingleton(sp =>
        {
            return new EmbeddingsModel();
        });

builder.Services.AddSingleton<DocumentIndexer>();

builder.Services.AddSingleton(sp => new IndexingQueue(
        researchDocsDir,
        sp.GetRequiredService<VectorDB>(),
        sp.GetRequiredService<DocumentIndexer>()));

builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
                    {
                        policy.AllowAnyOrigin()
                    .AllowAnyHeader()
                    .AllowAnyMethod();
                    });
        });

var app = builder.Build();

app.UseCors("AllowFrontend");

app.MapPost("/chat", async (VectorDB vdb, EmbeddingsModel embeddingsModel, IndexingQueue queue, [FromBody] QueryRequest request) =>
        {
            if (!queue.Statuses.Values.Any(status => status.Status == "Ready"))
            {
                return Results.BadRequest("Import a file to start asking questions.");
            }

            if (!await vdb.IsCreated())
            {
                return Results.InternalServerError("Vector database has not been created");
            }

            ChatRole strToRole(string role)
            {
                switch (role)
                {
                    case "user":
                        return ChatRole.User;
                    case "assistant":
                        return ChatRole.Assistant;
                    default:
                        break;
                }
                throw new Exception("Role does not exist");
            }

            IEnumerable<ChatMessage> conversation = request.Conversation.Select(msg => new ChatMessage(strToRole(msg.Role), msg.Text));
            var queryEmbedding = await embeddingsModel.GenerateEmbeddings(conversation.Last().Text);
            List<QueryMatch> matches = await vdb.Query(queryEmbedding.Vector.ToArray());
            var chatAgent = new ChatAgent();
            return Results.Ok(await chatAgent.Ask(conversation, matches.Select(x => x.Text)));
        });

app.MapPost("/parse", async ([FromBody] string PDFText) =>
        {
            var parser = new SectionParserAgent();
            var parsedSections = await parser.ParseSections(PDFText);
            return Results.Ok(parsedSections);
        });

app.MapGet("/files", (IndexingQueue queue) =>
        {
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var path in Directory.EnumerateFiles(researchDocsDir, "*.pdf"))
            {
                var name = Path.GetFileName(path);
                if (name is not null)
                {
                    names.Add(name);
                }
            }
            foreach (var name in queue.Statuses.Keys)
            {
                names.Add(name);
            }

            var files = names
                .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
                .Select(name =>
                {
                    queue.Statuses.TryGetValue(name, out var status);
                    return new ImportedFile(name, status?.Status ?? "Queued", status?.Error);
                })
                .ToList();

            return Results.Ok(files);
        });

app.MapDelete("/files/{fileName}", async (string fileName, IndexingQueue queue, VectorDB vdb) =>
        {
            var safeName = Path.GetFileName(fileName);
            if (string.IsNullOrEmpty(safeName) || safeName != fileName)
                return Results.BadRequest("Invalid file name");

            var destPath = Path.GetFullPath(Path.Combine(researchDocsDir, safeName));
            if (!destPath.StartsWith(researchDocsDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest("Invalid file name");

            if (!queue.IsTerminal(fileName))
                return Results.Conflict($"File '{fileName}' is still being indexed.");

            var fileExists = File.Exists(destPath);
            if (!fileExists && !queue.Statuses.ContainsKey(fileName))
                return Results.NotFound();

            await vdb.DeleteByImportedFile(fileName);
            if (fileExists)
            {
                File.Delete(destPath);
            }
            queue.Clear(fileName);
            return Results.NoContent();
        });

app.MapPost("/research-article", async (IFormFile file, IndexingQueue queue) =>
        {
            var safeName = Path.GetFileName(file.FileName);
            if (string.IsNullOrEmpty(safeName))
                return Results.BadRequest("Invalid file name");

            var destPath = Path.GetFullPath(Path.Combine(researchDocsDir, safeName));
            if (!destPath.StartsWith(researchDocsDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest("Invalid file name");

            await using (var dest = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                await file.CopyToAsync(dest);
            }

            queue.Enqueue(safeName);
            return Results.Created();
        }
        ).DisableAntiforgery();

var indexingQueue = app.Services.GetRequiredService<IndexingQueue>();
foreach (var path in Directory.EnumerateFiles(researchDocsDir, "*.pdf"))
{
    indexingQueue.Enqueue(Path.GetFileName(path)!);
}

app.Run();
