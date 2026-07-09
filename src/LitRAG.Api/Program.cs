using LitRAG.Core;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/pdf", () =>
{
    string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    string path = Path.Combine(home, "Personal/LitRAG/src/LitRAG.Core/Sample Papers/Kalantari 2023 Understanding-the-Language-of-ADHD-and-Autism-Communities-on-Social-Media.pdf");

    if (!File.Exists(path))
        return Results.NotFound($"File not found: {path}");

    List<string> pageInfo = Class1.ReadPdf(path);
    return Results.Ok(pageInfo);
});

app.Run();
