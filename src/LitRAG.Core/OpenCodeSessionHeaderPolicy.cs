namespace LitRAG.Core;

using System.ClientModel.Primitives;

/// <summary>
/// Injects the <c>X-Session-ID</c> header OpenCode Zen's relay requires for
/// free-tier models (e.g. muse-spark-1.3-contributor-free). Without it the
/// relay rejects anonymous/free-tier calls with
/// <c>400 MissingSessionID: OpenCode's free tier can only be used in OpenCode</c>.
/// One stable UUID per process, mirroring what the OpenCode client sends.
/// </summary>
internal sealed class OpenCodeSessionHeaderPolicy : PipelinePolicy
{
	public static readonly OpenCodeSessionHeaderPolicy Instance = new();

	private static readonly string SessionId = Guid.NewGuid().ToString();

	private OpenCodeSessionHeaderPolicy() { }

	public override void Process(PipelineMessage message, IReadOnlyList<PipelinePolicy> pipeline, int currentIndex)
	{
		message.Request.Headers.Set("X-Session-ID", SessionId);
		ProcessNext(message, pipeline, currentIndex);
	}

	public override ValueTask ProcessAsync(PipelineMessage message, IReadOnlyList<PipelinePolicy> pipeline, int currentIndex)
	{
		message.Request.Headers.Set("X-Session-ID", SessionId);
		return ProcessNextAsync(message, pipeline, currentIndex);
	}
}
