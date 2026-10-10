namespace DessertKitchen.Integrations;

// Extension boundary only. No provider adapter, credential storage, webhook route or live connection is implemented.
// Sprint 3 imports must stage raw rows, preview/validate, resolve product mappings, and commit with idempotency keys.
// Sprint 5 adapters are created only against authorised, documented provider access.
public interface IPlatformIntegration
{
    string Provider { get; }
    PlatformCapabilities Capabilities { get; }
    Task<ConnectionCheck> CheckAuthorisationAsync(CancellationToken cancellationToken);
    Task<PlatformPage<ExternalOrder>> RetrieveOrdersAsync(SyncWindow window, CancellationToken cancellationToken);
    Task<PlatformPage<ExternalFinancialEntry>> RetrieveFinancialEntriesAsync(SyncWindow window, CancellationToken cancellationToken);
    Task<VerifiedWebhook> VerifyWebhookAsync(ReadOnlyMemory<byte> rawBody, IReadOnlyDictionary<string, string> headers, CancellationToken cancellationToken);
    Task UpdateOrderStatusAsync(string externalOrderId, string status, string idempotencyKey, CancellationToken cancellationToken);
}

public record PlatformCapabilities(bool Orders, bool FinancialReports, bool Webhooks, bool StatusUpdates);
public record ConnectionCheck(bool Authorised, string Message);
public record SyncWindow(DateTimeOffset From, DateTimeOffset To, string? Cursor);
public record PlatformPage<T>(IReadOnlyList<T> Records, string? NextCursor, TimeSpan? RetryAfter);
public record ExternalOrder(string Provider, string ExternalId, DateTimeOffset OrderedAt, string Status,
    string Currency, decimal GrossSales, decimal Discount, IReadOnlyList<ExternalOrderLine> Lines);
public record ExternalOrderLine(string ExternalProductId, string Description, decimal Quantity,
    decimal GrossAmount, IReadOnlyDictionary<string, string> Modifiers);
public record ExternalFinancialEntry(string Provider, string ExternalId, string? ExternalOrderId,
    DateTimeOffset EffectiveAt, string Type, string Currency, decimal Amount, string? PayoutReference);
public record VerifiedWebhook(bool Valid, string? ExternalEventId, string? EventType, string? RejectionReason);

// Persist these mappings and sync logs with dedicated migrations in Sprint 3/5.
public record ProductMapping(string Provider, string ExternalProductId, string LocalRecipeId);
public record SynchronisationLog(string Provider, DateTimeOffset StartedAt, DateTimeOffset? CompletedAt,
    string Status, int Attempt, string? Cursor, string? ErrorCode);
