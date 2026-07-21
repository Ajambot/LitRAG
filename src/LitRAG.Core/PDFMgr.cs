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
					chunks.Add(string.Join(" ", buf[..(FindLastSentence(buf) + 1)].Select(w => w.Text)));
					buf.RemoveRange(0, Math.Max(FindLastSentence(buf) - overlap + 1, 0));
					buf.RemoveRange(0, FindFirstSentence(buf) + 1);
				}
			}
		}

		if (buf.Count != 0)
		{
			chunks.Add(string.Join(" ", buf.ToList()));
		}
		return chunks;
	}

	private static int FindLastSentence(List<Word> buf)
	{
		for (int i = buf.Count - 1; i >= 0; i--)
		{
			string curWord = buf[i].Text;
			switch (curWord[curWord.Length - 1])
			{
				case '.' or '?' or '!':
					return i;
			}
		}
		return buf.Count - 1;
	}

	private static int FindFirstSentence(List<Word> buf)
	{
		for (int i = 0; i < buf.Count; i++)
		{
			string curWord = buf[i].ToString();
			switch (curWord[curWord.Length - 1])
			{
				case '.' or '?' or '!':
					return i;
			}
		}
		return buf.Count - 1;
	}
}
