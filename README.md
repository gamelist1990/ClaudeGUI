# ClaudeGUI — Tauri + React + TypeScript デスクトップ GUI

このリポジトリは Claude CUI（ローカル CLI）を裏で起動して操作するためのデスクトップ GUI アプリケーションです。
アプリは Tauri 2.0 をフロントエンドに React + TypeScript (Vite) で構築し、バックエンドで Claude CLI を安全に起動・入出力するラッパーを提供します。

## 目的
- Claude の CUI を視覚的に扱いやすくする GUI を提供する
- タブ式の会話 UI、会話履歴の保存／検索、設定（起動オプション／環境変数）の管理を行えるようにする
- ライト/ダークテーマ対応、Google Material 風レイアウトで直感的な操作性を提供する

## 主な機能
- Claude CUI プロセスの起動／停止（Tauri/Rust 側のコマンドで制御）
- Claude の stdout / stderr をフロントエンドへストリーミングして表示
- 会話の入力送信（stdin へ書き込み）
- 会話履歴のローカル保存、検索、エクスポート／インポート（JSON）
- 環境変数や起動オプションの設定（ANTHROPIC_BASE_URL 等）
- マークダウンレンダリング（安全にサニタイズして表示）
- Composer（スニペット挿入）による入力補助
- 開発用テスト（Vitest）とビルド／パッケージング設定

## 技術スタック
- フロントエンド: React 19 + TypeScript + Vite
- デスクトップ: Tauri 2.0（Rust）
- Markdown: react-markdown + rehype-raw + rehype-sanitize
- テスト: Vitest + Testing Library

## 主要ファイル（要確認）
- src/App.tsx — メイン UI（タブ、会話一覧、Composer、履歴、設定）
- src/components/* — Composer, MarkdownView, Message などの UI コンポーネント
- src/services/claude.ts — フロントエンド用の Tauri 呼び出しラッパー
- src/services/storage.ts — 履歴の保存/読み出しユーティリティ
- src-tauri/src/lib.rs — Tauri 側コマンド（start_claude, send_input, stop_claude, status）
- claude.ts — （プロジェクトルート）既存の spawn ラッパー（参考）
- tauri.conf.json — Tauri のビルド/バンドル設定
- vitest.config.ts, src/__tests__ — テスト設定・サンプル

## Tauri 側で提供するコマンド／イベント
- コマンド
  - start_claude(args?: string[], envs?: HashMap<String,String>)
  - send_input(text: String)
  - stop_claude()
  - status() -> bool
- イベント
  - "claude-stdout" — stdout の行を逐次送信
  - "claude-stderr" — stderr の行を逐次送信

## 環境変数（例）
- ANTHROPIC_BASE_URL — カスタムエンドポイント
- ANTHROPIC_API_KEY — API キー（安全に管理してください）
- ANTHROPIC_MODEL — 使用するモデル名

注意: API キーなどの秘密はリポジトリに直書きしないでください。OS の環境変数や OS のシークレットストアを利用してください。

## 開発手順（ローカル）
1. 依存インストール
   - npm install
2. フロントエンド開発サーバ起動
   - npm run dev
3. Tauri 開発モード起動（別ターミナル）
   - npm run tauri -- dev
   - あるいは cargo tauri dev
4. テスト実行
   - npm run test
5. ビルド（配布用）
   - npm run build
   - tauri の build 手順に従ってパッケージを作成

## セキュリティと安全性
- 外部プロセス（claude）を起動するため、ユーザ入力の取り扱い、表示する出力のサニタイズ、イベント経路の制御に注意してください。
- --dangerously-skip-permissions の使用は慎重に。開発時の利便性のために追加している箇所がありますが、本番配布では権限設計を見直してください。

## 今後の作業候補
- トークン/使用量の表示（Anthropic API の応答ヘッダ等に依存）
- 多重セッション・タブごとのプロセス管理
- CLI オプションテンプレートとプロファイル管理
- ネイティブインストーラのカスタマイズ（コードサイニング等）

---
更新・修正はリポジトリ内の README.md を編集してください。問題や追加要望があれば要点を伝えてください。