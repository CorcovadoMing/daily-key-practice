# 今日練什麼調？ 🎹

一個免安裝、適合手機使用的每日大小調抽籤網頁。

## 功能

- 從 **12 個大調**和 **12 個小調**中自訂數量（各 0～12）。
- 每個調式獨立洗牌，當次不會重複抽到相同調性。
- 每天保留抽選結果，可重新抽選（重新抽選會先提示確認）。
- 按一下調性，即可標記完成；顯示今日進度。
- 可切換顯示大調音階／**自然小調**音階提示。
- 近期練習紀錄，以及複製當日清單。
- 全部資料只存在**目前瀏覽器的 localStorage**；不同裝置不會自動同步，清除網站資料會失去紀錄。

## 本機使用

直接用瀏覽器開啟 `index.html` 即可（無套件、無編譯步驟）。

## 部署到 GitHub Pages

1. 在 GitHub 新建一個 public repository，例如 `daily-key-practice`。
2. 將這個資料夾的**內容**（包括 `.github/workflows/deploy.yml`）提交至 `main` 分支。
3. 前往 GitHub Repository → **Settings → Pages**，在 **Build and deployment → Source** 選 **GitHub Actions**。
4. 在 **Actions** 查看 `Deploy website to GitHub Pages` 執行是否成功。
5. 完成後網站網址為 `https://<github-username>.github.io/<repository-name>/`。

往後每次 push 到 `main`，都會自動重新部署網站。

## 調性與音階

各包含 12 個不同音高類別。採常見書寫法表示等音調性（例如大調使用 `D♭`，小調使用 `C♯`）。

小調提示使用自然小調音階，不是和聲小調或旋律小調。

## 檔案

- `index.html` — 完整網站
- `.github/workflows/deploy.yml` — GitHub Pages 自動部署設定

此專案不依賴外部 API 或資料庫。