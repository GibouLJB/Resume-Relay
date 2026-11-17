$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$locales = @(
    @{
        Code='en'; Font='Segoe UI'
        Note='English operation guide. The current launcher displays Simplified Chinese.'
        Titles=@('Get to know the launcher','Session number or thread UUID?','Check the plan and start the worker')
        Menu=@('Create a task plan','List project sessions','Start or resume in the background','View progress','Stop the runner','Archive old progress','Check account and usage limits','Register the desktop plugin source','Run in the current window')
        Setup=@('First-time setup','Enter 8 to register the source. Restart Codex and install the plugin.')
        FirstRun='Your first run'
        Steps=@('1  Create a plan, then fill it in.','7  Check login and usage limits.','3  Review the plan and enter YES.','4  Confirm the actual worker status.')
        Reopen='Reopen Resume.cmd for the next operation.'
        SessionNote='Example project C:\Projects\todo-web. Replace the fictional UUID with your real ID.'
        Found='If a session list appears, enter its number'
        Chat='1. Improve the to-do website'
        Select='Session number or thread UUID → 1'
        Missing='If no sessions are found, paste the real UUID'
        MissingText='No sessions found. Check the original local chat and project path.'
        Paste='Session number or thread UUID →'
        IdTitle='Get the actual thread ID'
        IdText='Ask the original Codex chat to run (Get-Location).Path and $env:CODEX_THREAD_ID.'
        IdCheck='Verify the working directory, then paste the real ID into the launcher.'
        StartNote='Use option 7 first. Wait for the current turn in the original chat to finish.'
        Confirm='Choose option 3, review the plan, then enter YES'
        Project='Project folder → C:\Projects\todo-web'
        Plan='The launcher displays the project, thread ID, tasks, and test command.'
        Allow='Allow development and repeated tests in this project (type YES) → YES'
        Requested='Background start requested. Use option 4 to check its status.'
        Status='Reopen the launcher and select option 4'
        StatusNote='Example status. If phase is blocked, read note for the reason.'
        Finish='phase = complete means all tasks passed. While waiting, read note and nextCheck.'
    },
    @{
        Code='zh-TW'; Font='Microsoft JhengHei UI'
        Note='繁體中文操作示意圖。目前啟動工具的介面使用簡體中文。'
        Titles=@('先認識啟動工具的選單','對話編號與 UUID 應該怎麼填？','清單填好後，檢查並啟動')
        Menu=@('建立工作清單','查看專案對話','在背景啟動或恢復續跑','查看進度','停止續跑','封存舊進度','檢查帳號與額度介面','註冊桌面外掛來源','在目前視窗啟動續跑')
        Setup=@('首次安裝','輸入 8 註冊來源。重新啟動 Codex，再到外掛目錄安裝。')
        FirstRun='首次執行'
        Steps=@('1  建立清單，再填寫工作與測試指令','7  檢查登入與額度','3  核對計畫，輸入 YES','4  確認背景程序的實際狀態')
        Reopen='下一次操作請重新開啟 Resume.cmd。'
        SessionNote='範例專案 C:\Projects\todo-web。圖中 UUID 為虛構值，請換成真實 ID。'
        Found='出現對話清單時，輸入左側編號'
        Chat='1. 完善待辦清單網站'
        Select='輸入對話編號，或貼上對話 UUID → 1'
        Missing='找不到對話時，貼上真實 UUID'
        MissingText='找不到對話。請確認原本機對話與專案路徑。'
        Paste='輸入對話編號，或貼上對話 UUID →'
        IdTitle='取得真實對話 ID'
        IdText='在原 Codex 對話中，請它執行 (Get-Location).Path 和 $env:CODEX_THREAD_ID。'
        IdCheck='核對工作目錄，再把真實 ID 貼入啟動工具。'
        StartNote='先用選項 7 檢查帳號，並等待原對話目前回合結束。'
        Confirm='選擇 3，核對計畫後輸入 YES'
        Project='專案資料夾 → C:\Projects\todo-web'
        Plan='啟動工具會顯示專案、對話 ID、完整工作清單與測試指令。'
        Allow='允許在此專案開發並重複執行測試（輸入 YES）→ YES'
        Requested='已提交背景啟動要求。請以選項 4 確認實際狀態。'
        Status='重新開啟啟動工具，選擇 4 查看進度'
        StatusNote='以上為範例狀態。若為 blocked，請查看 note 中的原因。'
        Finish='phase = complete 表示全部通過。等待期間查看 note 與 nextCheck。'
    },
    @{
        Code='ja'; Font='Yu Gothic UI'
        Note='日本語の操作模式図。現在のランチャーの表示言語は簡体字中国語です。'
        Titles=@('ランチャーのメニューを確認する','セッション番号と UUID の入力方法','計画を確認して実行を開始する')
        Menu=@('タスク一覧を作成','プロジェクトの会話を表示','バックグラウンドで開始・再開','進捗を表示','停止','以前の進捗を保存して初期化','アカウントと利用枠を確認','プラグインの配布元を登録','現在のウィンドウで実行')
        Setup=@('初回の設定','8 で配布元を登録します。Codex を再起動してプラグインをインストールします。')
        FirstRun='初回の実行'
        Steps=@('1  一覧を作成して内容を記入','7  ログインと利用枠を確認','3  計画を確認し YES を入力','4  実際の実行状態を確認')
        Reopen='次の操作では Resume.cmd を開き直します。'
        SessionNote='例のプロジェクト C:\Projects\todo-web。架空の UUID は実際の ID に置き換えます。'
        Found='会話一覧が表示されたら、左側の番号を入力'
        Chat='1. ToDo サイトの改善'
        Select='セッション番号または会話 UUID → 1'
        Missing='会話が見つからない場合は、実際の UUID を入力'
        MissingText='会話が見つかりません。元のローカル会話とパスを確認してください。'
        Paste='セッション番号または会話 UUID →'
        IdTitle='実際の会話 ID を取得する'
        IdText='元の Codex 会話で (Get-Location).Path と $env:CODEX_THREAD_ID を実行してもらいます。'
        IdCheck='作業ディレクトリを確認し、実際の ID をランチャーに貼り付けます。'
        StartNote='先にメニュー 7 で確認し、元の会話の現在のターンが終わるまで待ちます。'
        Confirm='メニュー 3 を選び、計画を確認して YES を入力'
        Project='プロジェクトフォルダー → C:\Projects\todo-web'
        Plan='プロジェクト、会話 ID、タスク一覧、テストコマンドが表示されます。'
        Allow='このプロジェクトでの開発とテストの反復実行を許可（YES を入力）→ YES'
        Requested='バックグラウンド起動を要求しました。4 で状態を確認してください。'
        Status='ランチャーを開き直し、4 で進捗を確認'
        StatusNote='これは状態の例です。blocked の場合は note で理由を確認します。'
        Finish='phase = complete なら全タスク合格です。待機中は note と nextCheck を確認します。'
    }
)

function Draw-Text {
    param(
        [string]$Text, [int]$X, [int]$Y, [int]$Width, [int]$Height,
        [int]$Size=25, [string]$Color='#142b32', [switch]$Bold, [switch]$Mono
    )
    $family = if ($Mono) { 'Consolas' } else { $script:locale.Font }
    $style = if ($Bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
    $font = [Drawing.Font]::new($family,$Size,$style,[Drawing.GraphicsUnit]::Pixel)
    $brush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($Color))
    try {
        if ($font.Name -ne $family) { throw "Missing font $family" }
        if ($script:graphics.MeasureString($Text,$font,$Width).Height -gt $Height) {
            throw "Text overflows $($script:locale.Code): $Text"
        }
        $script:graphics.DrawString($Text,$font,$brush,[Drawing.RectangleF]::new($X,$Y,$Width,$Height))
    } finally { $font.Dispose(); $brush.Dispose() }
}

function Draw-Panel([int]$X,[int]$Y,[int]$Width,[int]$Height,[string]$Color='#151e28') {
    $brush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($Color))
    try { $script:graphics.FillRectangle($brush,$X,$Y,$Width,$Height) } finally { $brush.Dispose() }
}

function New-Canvas([string]$Title,[string]$Subtitle) {
    $script:bitmap = [Drawing.Bitmap]::new(1440,1030)
    $script:graphics = [Drawing.Graphics]::FromImage($script:bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#f3f5f7'))
    Draw-Panel 0 0 1440 146 '#102d33'
    Draw-Text $Title 42 24 1356 52 32 '#ffffff' -Bold
    Draw-Text $Subtitle 42 88 1356 42 21 '#c2dedb'
}

function Save-Canvas([string]$Name) {
    $dir = Join-Path $root ('docs/images/' + $script:locale.Code)
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    try { $bitmap.Save((Join-Path $dir $Name),[Drawing.Imaging.ImageFormat]::Png) }
    finally { $graphics.Dispose(); $bitmap.Dispose() }
}

foreach ($item in $locales) {
    $script:locale = $item
    New-Canvas $locale.Titles[0] $locale.Note
    Draw-Panel 40 182 750 786
    Draw-Text 'Resume Relay 0.1.0' 68 209 694 44 27 '#ffffff'
    for ($i=0; $i -lt 9; $i++) {
        $number = $i + 1
        $color = if ($number -in @(1,3,7,8)) { '#86e4cd' } else { '#e1e8ef' }
        Draw-Text "$number. $($locale.Menu[$i])" 68 (283+60*$i) 694 52 25 $color
    }
    Draw-Text $locale.Setup[0] 834 207 562 54 30 -Bold
    Draw-Text $locale.Setup[1] 834 270 558 150
    Draw-Text $locale.FirstRun 834 459 562 54 30 -Bold
    for ($i=0; $i -lt 4; $i++) { Draw-Text $locale.Steps[$i] 834 (526+62*$i) 558 58 }
    Draw-Text $locale.Reopen 834 851 558 100 23
    Save-Canvas 'launcher-guide.png'

    New-Canvas $locale.Titles[1] $locale.SessionNote
    Draw-Text $locale.Found 42 178 1356 54 30 -Bold
    Draw-Panel 40 242 1360 192
    Draw-Text $locale.Chat 68 266 1290 44 25 '#e1e8ef'
    Draw-Text '00000000-0000-4000-8000-000000000000' 68 309 1290 42 24 '#b5c5d5' -Mono
    Draw-Text $locale.Select 68 366 1290 46 25 '#86e4cd'
    Draw-Text $locale.Missing 42 481 1356 54 30 -Bold
    Draw-Panel 40 547 1360 197
    Draw-Text $locale.MissingText 68 571 1290 46 25 '#f7d08c'
    Draw-Text $locale.Paste 68 624 1290 44 25 '#e1e8ef'
    Draw-Text '00000000-0000-4000-8000-000000000000' 68 679 1290 42 24 '#86e4cd' -Mono
    Draw-Text $locale.IdTitle 42 785 1356 54 30 -Bold
    Draw-Text $locale.IdText 42 849 1356 72 24
    Draw-Text $locale.IdCheck 42 940 1356 60 24
    Save-Canvas 'session-guide.png'

    New-Canvas $locale.Titles[2] $locale.StartNote
    Draw-Text $locale.Confirm 42 179 1356 54 30 -Bold
    Draw-Panel 40 244 1360 348
    Draw-Text '3' 68 268 1290 42 25 '#e1e8ef'
    Draw-Text $locale.Project 68 314 1290 46 25 '#e1e8ef'
    Draw-Text $locale.Plan 68 369 1290 64 25 '#b5c5d5'
    Draw-Text $locale.Allow 68 445 1290 64 25 '#86e4cd'
    Draw-Text $locale.Requested 68 527 1290 48 24 '#e1e8ef'
    Draw-Text $locale.Status 42 634 1356 54 30 -Bold
    Draw-Panel 40 702 1360 156
    Draw-Text '"phase": "developing",  "verified": 0,  "total": 2,  "running": true' 68 730 1290 42 24 '#86e4cd' -Mono
    Draw-Text $locale.StatusNote 68 786 1290 52 24 '#b5c5d5'
    Draw-Text $locale.Finish 42 911 1356 82
    Save-Canvas 'start-guide.png'
}
