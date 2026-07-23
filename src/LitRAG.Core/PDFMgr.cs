namespace LitRAG.Core;

using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.DocumentLayoutAnalysis.WordExtractor;
using UglyToad.PdfPig.DocumentLayoutAnalysis.PageSegmenter;
using UglyToad.PdfPig.DocumentLayoutAnalysis.ReadingOrderDetector;
using UglyToad.PdfPig.DocumentLayoutAnalysis;
using System.Text;

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

	public static List<string> ChunkPdfBySections(string path, int chunkSize, int overlap)
	{
		var sections = GetPaperSectionWords(path);
		List<string> allChunks = [];

		foreach (var (sectionName, words) in sections)
		{
			allChunks.AddRange(ChunkWords(words, chunkSize, overlap));
		}
		return allChunks;
	}

	public static List<(string SectionName, List<Word> Words)> GetPaperSectionWords(string path)
	{
		var sections = new List<(string SectionName, List<Word> Words)>();
		string currentSection = "preamble";
		sections.Add((currentSection, new List<Word>()));

		using var document = PdfDocument.Open(path);
		double bodyFontSize = ComputeBodyFontSize(document);

		foreach (var block in GetAllOrderedTextBlocks(document))
		{
			if (IsSectionHeading(block, bodyFontSize))
			{
				currentSection = block.Text.Trim();
				sections.Add((currentSection, new List<Word>()));
				continue;
			}

			var blockWords = block.TextLines.SelectMany(line => line.Words);
			sections[^1].Words.AddRange(blockWords);
		}
		return sections;
	}

	public static List<(string SectionName, StringBuilder Body)> GetPaperSections(string path)
	{
		var sections = new List<(string SectionName, StringBuilder Body)>();
		string currentSection = "preamble";
		sections.Add((currentSection, new StringBuilder()));

		using var document = PdfDocument.Open(path);
		double bodyFontSize = ComputeBodyFontSize(document);

		foreach (var block in GetAllOrderedTextBlocks(document))
		{
			if (IsSectionHeading(block, bodyFontSize))
			{
				currentSection = block.Text.Trim();
				sections.Add((currentSection, new StringBuilder())); // always a new bucket, never overwrites
				continue;
			}
			sections[^1].Body.Append(block.Text).Append(' ');
		}
		return sections;
	}

	public static List<string> ChunkPdf(string path, int chunkSize, int overlap)
	{
		using PdfDocument document = PdfDocument.Open(path);
		var allWords = document.GetPages().SelectMany(page => page.GetWords());
		return ChunkWords(allWords, chunkSize, overlap);
	}
	// chunkSize - # of words each chunk should be
	// overlap - # of words that overlap between adjacent chunks
	// public static List<string> ChunkPdf(string path, int chunkSize, int overlap)
	// {
	// 	using PdfDocument document = PdfDocument.Open(path);
	// 	List<string> chunks = [];
	// 	var buf = new List<Word>(chunkSize);
	// 	foreach (Page page in document.GetPages())
	// 	{
	// 		foreach (Word word in page.GetWords())
	// 		{
	// 			buf.Add(word);
	// 			if (buf.Count == chunkSize)
	// 			{
	// 				int lastIdx = FindLastSentence(buf);
	// 				chunks.Add(string.Join(" ", buf[..(lastIdx + 1)].Select(w => w.Text)));
	// 				buf.RemoveRange(0, Math.Max(lastIdx - overlap + 1, 0));
	// 				lastIdx -= Math.Max(lastIdx - overlap + 1, 0);
	// 				buf.RemoveRange(0, Math.Min(lastIdx + 1, FindFirstSentence(buf)+1));
	// 			}
	// 		}
	// 	}

	// 	if (buf.Count != 0)
	// 	{
	// 		chunks.Add(string.Join(" ", buf.Select(w => w.Text)));
	// 	}
	// 	return chunks;
	// }

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
			string curWord = buf[i].Text;
			switch (curWord[curWord.Length - 1])
			{
				case '.' or '?' or '!':
					return i;
			}
		}
		return buf.Count - 1;
	}

	private static IEnumerable<TextBlock> GetAllOrderedTextBlocks(PdfDocument document)
	{
		IEnumerable<TextBlock> allOTB = [];
		foreach (Page page in document.GetPages())
		{
			IReadOnlyList<Letter> letters = page.Letters;
			var words = NearestNeighbourWordExtractor.Instance.GetWords(letters);

			var pageSegmenter = DocstrumBoundingBoxes.Instance;
			IReadOnlyList<TextBlock> blocks = pageSegmenter.GetBlocks(words);

			var readingOrder = UnsupervisedReadingOrderDetector.Instance;
			IEnumerable<TextBlock> ordered = readingOrder.Get(blocks);

			foreach (TextBlock block in ordered)
			{
				Console.WriteLine($"[{block.BoundingBox}] {block.Text}");
			}
			allOTB = allOTB.Concat(ordered);
		}
		return allOTB;
	}


	private static bool IsSectionHeading(TextBlock block, double bodyFontSize)
	{
		var firstLetter = block.TextLines.FirstOrDefault()?.Words.FirstOrDefault()?.Letters.FirstOrDefault();
		if (firstLetter == null) return false;

		bool isLarger = firstLetter.FontSize > bodyFontSize * 1.15;
		bool isBold = firstLetter.FontDetails.Name?.Contains("Bold", StringComparison.OrdinalIgnoreCase) == true;

		return isLarger || isBold;
	}

	private static double ComputeBodyFontSize(PdfDocument document)
	{
		return document.GetPages()
			.SelectMany(page => page.Letters)
			.GroupBy(letter => Math.Round(letter.FontSize, 1))
			.OrderByDescending(group => group.Count())
			.First()
			.Key;
	}

	private static List<string> ChunkWords(IEnumerable<Word> words, int chunkSize, int overlap)
	{
		List<string> chunks = [];
		var buf = new List<Word>(chunkSize);

		foreach (Word word in words)
		{
			buf.Add(word);
			if (buf.Count == chunkSize)
			{
				int lastIdx = FindLastSentence(buf);
				chunks.Add(string.Join(" ", buf[..(lastIdx + 1)].Select(w => w.Text)));

				int keepFrom = Math.Max(lastIdx - overlap + 1, 0);
				buf.RemoveRange(0, keepFrom);

				int boundaryIdx = lastIdx - keepFrom;
				buf.RemoveRange(0, Math.Min(boundaryIdx + 1, FindFirstSentence(buf) + 1));
			}
		}

		if (buf.Count != 0)
		{
			chunks.Add(string.Join(" ", buf.Select(w => w.Text)));
		}
		return chunks;
	}
}
