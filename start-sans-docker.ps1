$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

Write-Host "=== J.A.R.V.I.S (mode sans Docker) ===" -ForegroundColor Cyan
Write-Host ""

# --- Job Windows pour ne jamais laisser Jarvis tourner en fantome ---------
# Start-Process lance node comme un processus totalement independant : fermer
# la fenetre de ce script (croix, Ctrl+C, plantage...) ne l'arrete PAS tout
# seul, il continue de tourner cache et bloque le port au prochain lancement.
# Un "Job Object" Windows avec KILL_ON_JOB_CLOSE garantit que Windows tue
# node automatiquement des que CE process PowerShell se termine, quelle que
# soit la maniere dont il se termine.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class JarvisJobObject {
    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        public Int64 PerProcessUserTimeLimit;
        public Int64 PerJobUserTimeLimit;
        public UInt32 LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public UInt32 ActiveProcessLimit;
        public UIntPtr Affinity;
        public UInt32 PriorityClass;
        public UInt32 SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct IO_COUNTERS {
        public UInt64 ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public UInt64 ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    const int JobObjectExtendedLimitInformation = 9;
    const UInt32 JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateJobObject(IntPtr a, string lpName);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr hJob, int infoClass, IntPtr lpInfo, uint length);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    public static IntPtr CreateKillOnCloseJob() {
        IntPtr hJob = CreateJobObject(IntPtr.Zero, null);
        var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        IntPtr ptr = Marshal.AllocHGlobal(length);
        Marshal.StructureToPtr(info, ptr, false);
        SetInformationJobObject(hJob, JobObjectExtendedLimitInformation, ptr, (uint)length);
        Marshal.FreeHGlobal(ptr);
        return hJob;
    }
}
"@
$jarvisJobHandle = [JarvisJobObject]::CreateKillOnCloseJob()

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "node")) {
    Write-Host "Node.js n'est pas installe (ou pas dans le PATH)." -ForegroundColor Red
    Write-Host "Telecharge et installe la version LTS ici : https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Une fois installe, redemarre ton ordinateur puis relance ce script." -ForegroundColor Yellow
    Start-Process "https://nodejs.org/"
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

if (-not (Test-Command "ollama")) {
    Write-Host "Ollama n'est pas installe (ou pas dans le PATH)." -ForegroundColor Yellow
    Write-Host "Sans lui, Jarvis ne pourra pas repondre a moins d'utiliser une cle API" -ForegroundColor Yellow
    Write-Host "(OpenAI / Anthropic / Gemini) a la place dans /admin." -ForegroundColor Yellow
    Write-Host "Pour l'installer (gratuit) : https://ollama.com/download" -ForegroundColor Yellow
    Write-Host ""
}

# Cree un marqueur (ignore par git) pour que update.ps1 sache qu'il doit
# reconstruire avec npm plutot que reconstruire des images Docker.
New-Item -ItemType File -Path (Join-Path $root ".native-mode") -Force | Out-Null

# --- .env (facultatif, ignore par git) : cles SMTP pour les rapports de
# diagnostic (voir .env.example) et toute autre variable machine-locale.
# Exportees dans ce process pour que le serveur Node (lance plus bas) et le
# "chien de garde" de ce script (Send-JarvisAlert) les voient toutes les deux.
function Import-DotEnv([string]$Path) {
    if (-not (Test-Path $Path)) { return }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}
Import-DotEnv (Join-Path $root ".env")

function Send-JarvisAlert {
    param([string]$Subject, [string]$Body)
    $smtpHost = $env:REPORT_SMTP_HOST
    if (-not $smtpHost) { return } # pas configure sur cette machine : silencieux
    $port = if ($env:REPORT_SMTP_PORT) { [int]$env:REPORT_SMTP_PORT } else { 587 }
    $to = if ($env:REPORT_EMAIL_TO) { $env:REPORT_EMAIL_TO } else { "contact@informatiqueetsolution.fr" }
    $from = if ($env:REPORT_EMAIL_FROM) { $env:REPORT_EMAIL_FROM } elseif ($env:REPORT_SMTP_USER) { $env:REPORT_SMTP_USER } else { $to }
    try {
        $params = @{
            SmtpServer = $smtpHost
            Port       = $port
            UseSsl     = ($env:REPORT_SMTP_SECURE -eq "true")
            From       = $from
            To         = $to
            Subject    = $Subject
            Body       = $Body
            ErrorAction = "Stop"
        }
        if ($env:REPORT_SMTP_USER -and $env:REPORT_SMTP_PASS) {
            $securePass = ConvertTo-SecureString $env:REPORT_SMTP_PASS -AsPlainText -Force
            $params.Credential = New-Object System.Management.Automation.PSCredential($env:REPORT_SMTP_USER, $securePass)
        }
        Send-MailMessage @params
    } catch {
        Write-Host "Echec de l'envoi du rapport par email : $_" -ForegroundColor Yellow
    }
}

if (-not (Test-Path (Join-Path $root "node_modules"))) {
    Write-Host "Premiere installation : recuperation des dependances (peut prendre quelques minutes)..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install a echoue. Verifie ta connexion internet et reessaie." -ForegroundColor Red
        Read-Host "Appuie sur Entree pour fermer"
        exit 1
    }
}

Write-Host "Construction de Jarvis..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "La construction a echoue (voir le detail ci-dessus)." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

# --- Verification prealable du port -------------------------------------
# Evite de demarrer une boucle de redemarrage infinie pour rien si le port
# est deja pris par une autre application : mieux vaut un message clair et
# immediat.
$jarvisPort = if ($env:JARVIS_SERVER_PORT) { $env:JARVIS_SERVER_PORT } else { "4000" }
$portBusy = Get-NetTCPConnection -LocalPort $jarvisPort -State Listen -ErrorAction SilentlyContinue
if ($portBusy) {
    Write-Host "Le port $jarvisPort est deja utilise par une autre application." -ForegroundColor Red
    Write-Host "Ferme cette application, puis relance ce script." -ForegroundColor Yellow
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

# --- Demarrage + surveillance -------------------------------------------
# Redemarre automatiquement Jarvis s'il plante ou se fige (ne repond plus a
# /api/health), et envoie un rapport par email si REPORT_SMTP_HOST est
# configure (voir .env.example) - sans notification intrusive sur cette
# machine, juste un email au support.
Write-Host ""
Write-Host "=== Jarvis demarre sur http://localhost:4000 ===" -ForegroundColor Green
Write-Host "Laisse cette fenetre ouverte tant que tu veux utiliser Jarvis." -ForegroundColor Green
Write-Host "Pour l'arreter : ferme cette fenetre, ou Ctrl+C." -ForegroundColor Green
Write-Host ""
Write-Host "Panneau d'administration : http://localhost:4000/admin"
Write-Host "Fenetre Jarvis (test)     : http://localhost:4000/jarvis"
Write-Host "Vue OBS (source navigateur) : http://localhost:4000/overlay?transparent=1"
Write-Host ""

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:4000/admin"
} | Out-Null

$serverDir = Join-Path $root "server"
$outLog = Join-Path $root "jarvis-server.log"
$errLog = Join-Path $root "jarvis-server.err.log"
$maxQuickRestarts = 5
$restartWindowSeconds = 300
$restartTimestamps = @()

while ($true) {
    $proc = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory $serverDir `
        -PassThru -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    [JarvisJobObject]::AssignProcessToJobObject($jarvisJobHandle, $proc.Handle) | Out-Null

    $consecutiveHealthFailures = 0
    $killedForFreeze = $false

    while (-not $proc.HasExited) {
        Start-Sleep -Seconds 60
        if ($proc.HasExited) { break }
        try {
            Invoke-WebRequest -Uri "http://localhost:4000/api/health" -TimeoutSec 10 -UseBasicParsing | Out-Null
            $consecutiveHealthFailures = 0
        } catch {
            $consecutiveHealthFailures++
        }
        if ($consecutiveHealthFailures -ge 3) {
            Write-Host "Jarvis ne repond plus depuis plusieurs minutes (freeze detecte) - redemarrage." -ForegroundColor Red
            Send-JarvisAlert -Subject "[Jarvis] Freeze detecte sur $env:COMPUTERNAME" `
                -Body "Jarvis ne repond plus depuis environ $consecutiveHealthFailures minute(s) (aucun crash detecte, le process semble bloque). Redemarrage automatique en cours."
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
            $killedForFreeze = $true
            break
        }
    }

    if (-not $killedForFreeze) {
        # .Refresh() evite de lire un ExitCode pas encore mis a jour quand le
        # process vient de se terminer (sinon souvent vide juste apres un
        # crash tres rapide, ex: port deja utilise).
        $proc.Refresh()
        Write-Host "Le serveur Jarvis s'est arrete (code $($proc.ExitCode))." -ForegroundColor Yellow
    }

    $now = Get-Date
    $restartTimestamps = @($restartTimestamps | Where-Object { $_ -gt $now.AddSeconds(-$restartWindowSeconds) })
    $restartTimestamps += $now
    if ($restartTimestamps.Count -gt $maxQuickRestarts) {
        Write-Host "Trop de redemarrages en peu de temps : arret pour eviter une boucle infinie." -ForegroundColor Red
        Write-Host "Verifie server\data\settings.json et jarvis-server.err.log, puis relance start-sans-docker.bat."
        break
    }

    Write-Host "Redemarrage dans 5 secondes..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
}

Read-Host "Appuie sur Entree pour fermer"
