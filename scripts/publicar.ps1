param(
  [string]$Mensagem = "Atualização do painel"
)

# Publica uma versão do painel:
# 1. confere se o build passa
# 2. salva as mudanças em um commit
# 3. cria uma etiqueta de versão (para voltar depois, se precisar)
# 4. envia ao GitHub (a Vercel publica sozinha)
# 5. guarda um backup do código em Documentos\Backups

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

Write-Host "Conferindo o build..." -ForegroundColor Cyan
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "O build falhou. Nada foi publicado." }

$data = Get-Date -Format "yyyy-MM-dd_HH-mm"
$versao = "v$data"

git add -A
$temMudancas = (git status --porcelain | Measure-Object).Count -gt 0
if ($temMudancas) {
  $texto = @"
$Mensagem

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
"@
  git commit -q -m $texto
  Write-Host "Commit criado." -ForegroundColor Green
} else {
  Write-Host "Nenhuma mudança nova para commitar." -ForegroundColor Yellow
}

git tag -a $versao -m "$Mensagem"
git push -q origin main
git push -q origin $versao
Write-Host "Enviado ao GitHub. A Vercel vai publicar em alguns minutos." -ForegroundColor Green

$pastaBackup = "C:\Users\Vinicius\Documents\Backups\Painel Direct Promocoes"
New-Item -ItemType Directory -Force -Path $pastaBackup | Out-Null
$arquivo = Join-Path $pastaBackup "painel-$versao.zip"
git archive --format=zip -o $arquivo HEAD
Write-Host "Backup salvo em: $arquivo" -ForegroundColor Green
Write-Host "Versão: $versao" -ForegroundColor Green
