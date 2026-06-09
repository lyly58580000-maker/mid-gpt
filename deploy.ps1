# 从仓库根目录部署到 Vercel（Root Directory 已设为 sheyan-ai 时必须在此执行）
Set-Location $PSScriptRoot
npx vercel deploy --prod @args
