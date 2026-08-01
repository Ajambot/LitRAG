namespace LitRAG.Core;

using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.DocumentLayoutAnalysis.WordExtractor;

public sealed class PDFMgr
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


	private static int FindLastSentence(List<string> buf)
	{
		for (int i = buf.Count - 1; i >= 0; i--)
		{
			string curWord = buf[i];
			switch (curWord[curWord.Length - 1])
			{
				case '.' or '?' or '!':
					return i;
			}
		}
		return buf.Count - 1;
	}

	private static int FindFirstSentence(List<string> buf)
	{
		for (int i = 0; i < buf.Count; i++)
		{
			string curWord = buf[i];
			switch (curWord[curWord.Length - 1])
			{
				case '.' or '?' or '!':
					return i;
			}
		}
		return buf.Count - 1;
	}

	public static List<string> ChunkWords(IEnumerable<string> words, int chunkSize, int overlap)
	{
		List<string> chunks = [];
		var buf = new List<string>(chunkSize);

		foreach (string word in words)
		{
			buf.Add(word);
			if (buf.Count == chunkSize)
			{
				int lastIdx = FindLastSentence(buf);
				chunks.Add(string.Join(" ", buf[..(lastIdx + 1)]));

				int keepFrom = Math.Max(lastIdx - overlap + 1, 0);
				buf.RemoveRange(0, keepFrom);

				int boundaryIdx = lastIdx - keepFrom;
				buf.RemoveRange(0, Math.Min(boundaryIdx + 1, FindFirstSentence(buf) + 1));
			}
		}

		if (buf.Count != 0)
		{
			chunks.Add(string.Join(" ", buf));
		}
		return chunks;
	}
}
