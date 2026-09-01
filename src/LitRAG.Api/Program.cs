using LitRAG.Core;
using UglyToad.PdfPig.Content;
using Microsoft.AspNetCore.Mvc;
using UglyToad.PdfPig;
using System.Text;

AppContext.SetSwitch("System.Net.Http.SocketsHttpHandler.Http2UnencryptedSupport", true);
var builder = WebApplication.CreateBuilder(args);

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

app.MapPost("/vectordb/insert", async (VectorDB vdb, EmbeddingsModel embeddingsModel, [FromBody] string text) =>
{
    await vdb.EnsureCreated();
    var embedding = await embeddingsModel.GenerateEmbeddings(text);
    await vdb.InsertPoint(embedding.Vector.ToArray(), text);
    return Results.Ok();
});


app.MapPost("/vectordb/query", async (VectorDB vdb, EmbeddingsModel embeddingsModel, [FromBody] QueryRequest request) =>
{
    if (!await vdb.IsCreated())
    {
        return Results.NotFound("Vector database has not been created");
    }
    var queryEmbedding = await embeddingsModel.GenerateEmbeddings(request.Query);
    List<QueryMatch> matches = await vdb.Query(queryEmbedding.Vector.ToArray());
    return Results.Ok(matches);
});

app.MapPost("/chat", async (VectorDB vdb, EmbeddingsModel embeddingsModel, [FromBody] QueryRequest question) =>
{
    if (!await vdb.IsCreated())
    {
        return Results.InternalServerError("Vector database has not been created");
    }
    var queryEmbedding = await embeddingsModel.GenerateEmbeddings(question.Query);
    List<QueryMatch> matches = await vdb.Query(queryEmbedding.Vector.ToArray());
    var chatAgent = new ChatAgent();
    return Results.Ok(await chatAgent.Ask(question.Query, matches.Select(x => x.Text)));
});

app.MapPost("/parse", async ([FromBody] string PDFText) =>
{
    var parser = new SectionParserAgent();
    var parsedSections = await parser.ParseSections(PDFText);
    return Results.Ok(parsedSections);
});

app.MapGet("/pdf", () =>
{
    string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    string path = Path.Combine(home, "Personal/LitRAG/src/LitRAG.Core/Sample Papers/Kalantari 2023 Understanding-the-Language-of-ADHD-and-Autism-Communities-on-Social-Media.pdf");

    if (!File.Exists(path))
        return Results.NotFound($"File not found: {path}");

    List<IEnumerable<Word>> pages = PDFMgr.ReadPdf(path);
    return Results.Ok(string.Join(" ", pages.ElementAt(1).TakeWhile(w => true)));
    ///List<string> resp = [];
    ///foreach (IEnumerable<Word> page in pages)
    ///{
    ///    resp.Add(string.Join(" ", page.Take(500)));
    ///}
    ///return Results.Ok(resp);
});

app.MapGet("/chunk", async (VectorDB vdb, EmbeddingsModel embeddingsModel) =>
{
    string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    string path = Path.Combine(home, "Personal/LitRAG/src/LitRAG.Core/Sample Papers/micro_research_paper.pdf");

    if (!File.Exists(path))
        return Results.NotFound($"File not found: {path}");

    using var document = PdfDocument.Open(path);
    var sb = new StringBuilder();

    foreach (var page in document.GetPages())
    {
        sb.AppendLine(page.Text);
    }

    string allText = sb.ToString();


    var parser = new SectionParserAgent();
    var parsedSections = await parser.ParseSections(allText);

    List<string> chunks = [];
    foreach (var (section, text) in parsedSections)
    {
        List<string> words = text
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .ToList();
        List<string> sectionChunks = PDFMgr.ChunkWords(words, 350, 50);
        chunks.AddRange(sectionChunks);
    }

    foreach (var chunk in chunks)
    {
        await vdb.EnsureCreated();
        var embedding = await embeddingsModel.GenerateEmbeddings(chunk);
        await vdb.InsertPoint(embedding.Vector.ToArray(), chunk);
    }

    return Results.Ok();
});

app.Run();
