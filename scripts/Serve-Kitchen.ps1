$ErrorActionPreference = 'Stop'
$kitchenRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $kitchenRoot
$serverProcess = $null
$serverLifetime = $null

# Windows closes this job handle when the launcher exits, including when its
# console window is closed or the launcher is terminated without running finally.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

public sealed class KitchenServerLifetime : IDisposable
{
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits
    {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters
    {
        public ulong ReadOperations, WriteOperations, OtherOperations;
        public ulong ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimits
    {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits limits, uint size);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);
    private IntPtr handle;

    public KitchenServerLifetime()
    {
        handle = CreateJobObject(IntPtr.Zero, null);
        if (handle == IntPtr.Zero) throw new Win32Exception();
        var limits = new ExtendedLimits();
        limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if (!SetInformationJobObject(handle, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits))))
        {
            var error = new Win32Exception();
            Dispose();
            throw error;
        }
    }
    public void Attach(Process process)
    {
        if (!AssignProcessToJobObject(handle, process.Handle)) throw new Win32Exception();
    }
    public void Dispose()
    {
        if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; }
    }
}
'@

try {
    # Refuse to replace an existing listener or stop somebody else's process.
    $portProbe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 5080)
    try { $portProbe.Start() }
    catch { throw 'Port 5080 is already in use. Close the other kitchen server window before starting this one.' }
    finally { $portProbe.Stop() }

    Write-Host 'Preparing Dessert Kitchen Manager...' -ForegroundColor Cyan
    if (-not (Test-Path -LiteralPath 'client\node_modules')) {
        & npm.cmd --prefix client ci
        if ($LASTEXITCODE -ne 0) { throw 'Installing frontend dependencies failed.' }
    }
    & npm.cmd --prefix client run build
    if ($LASTEXITCODE -ne 0) { throw 'Building the frontend failed.' }
    & dotnet build server -c Release --nologo
    if ($LASTEXITCODE -ne 0) { throw 'Building the local server failed.' }

    $serverLifetime = New-Object KitchenServerLifetime
    $serverStart = New-Object System.Diagnostics.ProcessStartInfo
    $serverStart.FileName = (Get-Command dotnet -ErrorAction Stop).Source
    $serverStart.WorkingDirectory = Join-Path $kitchenRoot 'server'
    $serverDll = Join-Path $kitchenRoot 'server\bin\Release\net8.0\DessertKitchen.Api.dll'
    $serverContent = Join-Path $kitchenRoot 'server'
    $kitchenDatabase = Join-Path $kitchenRoot 'data\kitchen.db'
    $serverStart.Arguments = '"{0}" --contentRoot "{1}" --DatabasePath "{2}" --urls http://127.0.0.1:5080' -f $serverDll, $serverContent, $kitchenDatabase
    $serverStart.UseShellExecute = $false
    $serverProcess = [System.Diagnostics.Process]::Start($serverStart)
    $serverLifetime.Attach($serverProcess)

    Write-Host ''
    Write-Host 'Open http://127.0.0.1:5080 once the server reports it is listening.' -ForegroundColor Green
    Write-Host 'Keep THIS window open while using your kitchen.' -ForegroundColor Cyan
    Write-Host 'Close this window or press Ctrl+C to stop serving the site.'
    Write-Host 'Your saved recipes and stock remain in data\kitchen.db.'
    Write-Host ''
    # A short wait lets PowerShell handle Ctrl+C and run the cleanup below.
    while (-not $serverProcess.WaitForExit(200)) { }
    if ($serverProcess.ExitCode -ne 0) { throw 'The kitchen server stopped unexpectedly. See the message above.' }
}
catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
finally {
    if ($serverLifetime) { $serverLifetime.Dispose() }
    if ($serverProcess) {
        # Also covers failure to attach the process to the lifetime job.
        if (-not $serverProcess.HasExited) { $serverProcess.Kill(); $serverProcess.WaitForExit() }
        $serverProcess.Dispose()
    }
}
