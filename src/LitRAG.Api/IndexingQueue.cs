namespace LitRAG.Api;

using System.Collections.Concurrent;
using System.Threading.Channels;
using LitRAG.Core;

public sealed record FileStatus(string Status, string? Error = null);

public sealed class IndexingQueue
{
	private readonly ConcurrentDictionary<string, FileStatus> statuses = new(StringComparer.OrdinalIgnoreCase);
	private readonly Channel<string> channel = Channel.CreateUnbounded<string>(new UnboundedChannelOptions
	{
		SingleReader = true,
		SingleWriter = false,
	});
	private readonly string researchDocsDir;
	private readonly VectorDB vdb;
	private readonly DocumentIndexer indexer;

	public IndexingQueue(string researchDocsDir, VectorDB vdb, DocumentIndexer indexer)
	{
		this.researchDocsDir = researchDocsDir;
		this.vdb = vdb;
		this.indexer = indexer;
		_ = Task.Run(ProcessQueueAsync);
	}

	public IReadOnlyDictionary<string, FileStatus> Statuses => statuses;

	public bool IsTerminal(string fileName) =>
		statuses.TryGetValue(fileName, out var status) && status.Status is "Ready" or "Failed";

	public void Enqueue(string fileName)
	{
		statuses[fileName] = new FileStatus("Queued");
		channel.Writer.TryWrite(fileName);
	}

	public void Clear(string fileName) => statuses.TryRemove(fileName, out _);

	private async Task ProcessQueueAsync()
	{
		await foreach (var fileName in channel.Reader.ReadAllAsync())
		{
			statuses[fileName] = new FileStatus("Indexing");
			var path = Path.Combine(researchDocsDir, fileName);

			try
			{
				await vdb.DeleteByImportedFile(fileName);
				await indexer.IndexAsync(path, fileName);
				statuses[fileName] = new FileStatus("Ready");
			}
			catch (Exception ex)
			{
				try
				{
					await vdb.DeleteByImportedFile(fileName);
				}
				catch (Exception)
				{
				}
				statuses[fileName] = new FileStatus("Failed", ex.Message);
			}
		}
	}
}
