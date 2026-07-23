using LitRAG.Core;
using UglyToad.PdfPig.Content;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/pdf", () =>
{
    string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    string path = Path.Combine(home, "Personal/LitRAG/src/LitRAG.Core/Sample Papers/Kalantari 2023 Understanding-the-Language-of-ADHD-and-Autism-Communities-on-Social-Media.pdf");

    if (!File.Exists(path))
        return Results.NotFound($"File not found: {path}");

    List<IEnumerable<Word>> pages = PDFMgr.ReadPdf(path);
    List<string> resp = [];
    foreach (IEnumerable<Word> page in pages)
    {
        resp.Add(string.Join(" ", page.Take(500)));
    }
    return Results.Ok(resp);
});

app.MapGet("/chunk", () =>
{
    string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    string path = Path.Combine(home, "Personal/LitRAG/src/LitRAG.Core/Sample Papers/Kalantari 2023 Understanding-the-Language-of-ADHD-and-Autism-Communities-on-Social-Media.pdf");

    if (!File.Exists(path))
        return Results.NotFound($"File not found: {path}");

    return Results.Ok(PDFMgr.ChunkPdf(path, 350, 50));
});

app.MapGet("/chunk-by-section", () =>
{
    string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    string path = Path.Combine(home, "Personal/LitRAG/src/LitRAG.Core/Sample Papers/Kalantari 2023 Understanding-the-Language-of-ADHD-and-Autism-Communities-on-Social-Media.pdf");

    if (!File.Exists(path))
        return Results.NotFound($"File not found: {path}");

    return Results.Ok(PDFMgr.ChunkPdfBySections(path, 350, 50));
});

app.Run();
