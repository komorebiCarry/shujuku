#!/usr/bin/env bash
# scripts/publish-extension.sh — 一键构建插件并推送到 release 制品分支
#
# 用法：
#   npm run publish:extension          # 使用 manifest.json 中的版本号
#   npm run publish:extension -- 1.2.0 # 指定版本号
#
# 流程：
#   1. 检查工作区是否干净（未提交的修改会被 stash）
#   2. 构建插件（BUILD_MODE=extension rollup -c）
#   3. 复制产物到临时目录
#   4. 切换到 release 孤儿分支
#   5. 用新产物覆盖旧文件
#   6. 提交并推送
#   7. 切回原来的开发分支，恢复 stash

set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# 颜色输出
# ═══════════════════════════════════════════════════════════════
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ═══════════════════════════════════════════════════════════════
# 参数和变量
# ═══════════════════════════════════════════════════════════════
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_BRANCH="release"
TMP_DIR="/tmp/acu-extension-publish-$$"
MANIFEST="$PROJECT_ROOT/manifest.json"
DIST_DIR="$PROJECT_ROOT/dist/extension"

cd "$PROJECT_ROOT"

# 记录当前分支
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
STASHED=false

# 版本号：优先用命令行参数，否则从 manifest.json 读取
if [ -n "${1:-}" ]; then
    VERSION="$1"
    info "使用指定版本号: $VERSION"
else
    VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')).version)")"
    info "从 manifest.json 读取版本号: $VERSION"
fi

# ═══════════════════════════════════════════════════════════════
# 清理函数（确保异常退出时恢复状态）
# ═══════════════════════════════════════════════════════════════
cleanup() {
    local exit_code=$?
    # 清理临时目录
    rm -rf "$TMP_DIR" 2>/dev/null || true
    # 确保回到原来的分支
    if [ "$(git rev-parse --abbrev-ref HEAD)" != "$CURRENT_BRANCH" ]; then
        warn "异常退出，切回 $CURRENT_BRANCH 分支..."
        git checkout "$CURRENT_BRANCH" 2>/dev/null || true
    fi
    # 恢复 stash
    if [ "$STASHED" = true ]; then
        warn "恢复 stash..."
        git stash pop 2>/dev/null || true
    fi
    if [ $exit_code -ne 0 ]; then
        fail "发布失败！已恢复到原始状态。"
    fi
}
trap cleanup EXIT

# ═══════════════════════════════════════════════════════════════
# Step 1: 检查环境
# ═══════════════════════════════════════════════════════════════
info "Step 1/6: 检查环境..."

# 检查 manifest.json 是否存在
if [ ! -f "$MANIFEST" ]; then
    fail "manifest.json 不存在！请先创建。"
fi

# 检查 release 分支是否存在
if ! git rev-parse --verify "$RELEASE_BRANCH" >/dev/null 2>&1; then
    fail "release 分支不存在！请先创建：git checkout --orphan release"
fi

ok "环境检查通过"

# ═══════════════════════════════════════════════════════════════
# Step 2: 构建插件
# ═══════════════════════════════════════════════════════════════
info "Step 2/6: 构建插件..."

BUILD_MODE=extension npx rollup -c 2>&1 | grep -E "(created|→|Error|error)" || true

if [ ! -f "$DIST_DIR/index.js" ] || [ ! -f "$DIST_DIR/manifest.json" ]; then
    fail "构建失败：dist/extension/ 下缺少 index.js 或 manifest.json"
fi

INDEX_SIZE=$(wc -c < "$DIST_DIR/index.js" | tr -d ' ')
ok "构建完成: index.js (${INDEX_SIZE} bytes)"

# ═══════════════════════════════════════════════════════════════
# Step 3: 复制产物到临时目录
# ═══════════════════════════════════════════════════════════════
info "Step 3/6: 备份产物..."

mkdir -p "$TMP_DIR"
cp "$DIST_DIR/index.js" "$TMP_DIR/index.js"
cp "$DIST_DIR/manifest.json" "$TMP_DIR/manifest.json"

ok "产物已备份到 $TMP_DIR"

# ═══════════════════════════════════════════════════════════════
# Step 4: Stash 工作区 + 切换到 release 分支
# ═══════════════════════════════════════════════════════════════
info "Step 4/6: 切换到 release 分支..."

# 检查是否有未提交的修改（包括 untracked 文件中的 manifest.json）
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    info "检测到未提交的修改，执行 stash..."
    git stash push -m "publish-extension: auto stash before release" 2>/dev/null
    STASHED=true
fi

# 处理 untracked 的 manifest.json（release 分支上有这个文件，切换时会冲突）
if [ -f "$PROJECT_ROOT/manifest.json" ] && ! git ls-files --error-unmatch manifest.json >/dev/null 2>&1; then
    rm "$PROJECT_ROOT/manifest.json"
fi

git checkout "$RELEASE_BRANCH"
ok "已切换到 $RELEASE_BRANCH 分支"

# ═══════════════════════════════════════════════════════════════
# Step 5: 覆盖产物 + 提交
# ═══════════════════════════════════════════════════════════════
info "Step 5/6: 更新产物..."

cp "$TMP_DIR/index.js" "$PROJECT_ROOT/index.js"
cp "$TMP_DIR/manifest.json" "$PROJECT_ROOT/manifest.json"

# 检查是否有实际变更
if git diff --quiet index.js manifest.json 2>/dev/null; then
    warn "产物内容无变化，跳过提交。"
else
    git add index.js manifest.json
    git commit -m "release: v${VERSION}" -m "构建时间: $(date '+%Y-%m-%d %H:%M:%S')" -m "来源分支: ${CURRENT_BRANCH}"
    ok "已提交: release v${VERSION}"
fi

# ═══════════════════════════════════════════════════════════════
# Step 6: 推送 + 切回开发分支
# ═══════════════════════════════════════════════════════════════
info "Step 6/6: 推送到远程..."

git push origin "$RELEASE_BRANCH"
ok "已推送到 origin/$RELEASE_BRANCH"

# 切回开发分支
git checkout "$CURRENT_BRANCH"
ok "已切回 $CURRENT_BRANCH 分支"

# 恢复 stash
if [ "$STASHED" = true ]; then
    git stash pop 2>/dev/null || warn "stash pop 失败，请手动执行 git stash pop"
    STASHED=false
fi

# 恢复 manifest.json（如果开发分支上需要）
if [ ! -f "$PROJECT_ROOT/manifest.json" ]; then
    cp "$TMP_DIR/manifest.json" "$PROJECT_ROOT/manifest.json"
fi

# 清理临时目录
rm -rf "$TMP_DIR"

echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 发布成功！v${VERSION}${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo "  安装方式："
echo "    URL:    https://github.com/AlbusKen/shujuku"
echo "    Branch: release"
echo ""
