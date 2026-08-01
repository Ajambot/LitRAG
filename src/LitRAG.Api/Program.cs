using LitRAG.Core;
using UglyToad.PdfPig.Content;
using Microsoft.AspNetCore.Mvc;
using UglyToad.PdfPig;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();


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

app.MapGet("/chunk", async () =>
{
    string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    string path = Path.Combine(home, "Personal/LitRAG/src/LitRAG.Core/Sample Papers/Kalantari 2023 Understanding-the-Language-of-ADHD-and-Autism-Communities-on-Social-Media.pdf");

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
    return Results.Ok(chunks);
});

app.Run();
