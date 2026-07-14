namespace LitRAG.Core;

using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.DocumentLayoutAnalysis.WordExtractor;

public class PDFMgr
{
	public static List<IEnumerable<Word>> ReadPdf(string path)
	{
		using PdfDocument document = PdfDocument.Open(path);
		List<IEnumerable<Word>> pageInfo = [];
		foreach (Page page in document.GetPages())
		{
			IEnumerable<Word> words = page.GetWords(NearestNeighbourWordExtractor.Instance);
			pageInfo.Add(words);
		}
		return pageInfo;
	}

	// chunkSize - # of words each chunk should be
	// overlap - # of words that overlap between adjacent chunks
	public static List<string> ChunkPdf(string path, int chunkSize, int overlap)
	{
		using PdfDocument document = PdfDocument.Open(path);
		List<string> chunks = [];
		var buf = new List<Word>(chunkSize);
		foreach (Page page in document.GetPages())
		{
			foreach (Word word in page.GetWords())
			{
				buf.Add(word);
				if (buf.Count == chunkSize)
				{
					chunks.Add(string.Join(" ", buf.ToList()));
					buf.RemoveRange(0, chunkSize - overlap);
				}
			}
		}

		if (buf.Count != 0)
		{
			chunks.Add(string.Join(" ", buf.ToList()));
		}
		return chunks;
	}
}
