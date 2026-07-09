namespace LitRAG.Core;

using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.DocumentLayoutAnalysis.WordExtractor;
using System.Linq;

public class Class1
{
	public static List<string> ReadPdf(string path)
	{
		using PdfDocument document = PdfDocument.Open(path);
		List<string> pageInfo = [];
		foreach (Page page in document.GetPages())
		{
			IEnumerable<Word> words = page.GetWords(NearestNeighbourWordExtractor.Instance);
			string first500Words = string.Join(" ", words.Take(500).Select(w => w.Text));
			pageInfo.Add(first500Words);
		}
		return pageInfo;
	}
}
