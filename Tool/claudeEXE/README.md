このフォルダには `claude` 実行ファイルを起動する簡易ランチャースクリプトがあります。

使い方:

- Windows:
  - 優先的に `C:\nvm4w\nodejs\claude.cmd` などを探します。
  - 見つかった場合はそれを直接 spawn して起動します。
  - 見つからない場合は PATH 上の `claude.cmd` を使います。

- macOS / Linux:
  - PATH 上の `claude` コマンドを実行します。

API:

- runClaude(args?: string[]): Promise<{ code: number | null; signal: NodeJS.Signals | null }>
  - 指定した引数で claude コマンドを起動し、終了時のコードとシグナルを返します。

CLI:

- node index.js [args...]
  - そのまま `claude` に引数を渡して実行します。

備考:
- このスクリプトは Node.js の `child_process.spawn` を使用しており、標準入出力を親プロセスに接続します。
- 他の OS 固有のインストールパスを追加したい場合は `findClaudeExecutable` を編集してください。