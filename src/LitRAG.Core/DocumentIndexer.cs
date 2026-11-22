namespace LitRAG.Core;

using System.Text;
using UglyToad.PdfPig;

public sealed class DocumentIndexer(VectorDB vdb, EmbeddingsModel embeddingsModel)
{
	public async Task IndexAsync(string path, string importedFile)
	{
		try
		{
			await vdb.EnsureCreated();

			using var document = PdfDocument.Open(path);
			var sb = new StringBuilder();
			foreach (var page in document.GetPages())
			{
				sb.AppendLine(page.Text);
			}

			var parser = new SectionParserAgent();
			var sections = await parser.ParseSections(sb.ToString());

			var chunks = new List<string>();
			foreach (var (_, text) in sections)
			{
				var words = text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
				chunks.AddRange(PDFMgr.ChunkWords(words, 350, 50));
			}

			foreach (var chunk in chunks)
			{
				if (!File.Exists(path))
				{
					throw new IOException($"Imported File '{importedFile}' was removed while indexing.");
				}

				var embedding = await embeddingsModel.GenerateEmbeddings(chunk);
				await vdb.InsertPoint(embedding.Vector.ToArray(), chunk, importedFile);
			}
		}
		catch
		{
			await vdb.DeleteByImportedFile(importedFile);
			throw;
		}
	}
}
