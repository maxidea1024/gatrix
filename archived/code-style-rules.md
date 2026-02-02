# 코드 스타일 규칙

## 인덴트 규칙 (필수!)

**절대 4 spaces를 사용하지 않습니다!**

모든 TypeScript, TSX, JavaScript 파일은 **2 spaces** 인덴트를 사용해야 합니다.

`.editorconfig` 파일에 다음과 같이 설정되어 있습니다:

```
[*]
indent_style = space
indent_size = 2
```

### 체크리스트
- [ ] 코드 작성 시 항상 2 spaces 사용
- [ ] 기존 코드와 일관성 유지
- [ ] 의심스러울 때는 주변 코드의 인덴트 확인

### 포맷팅 명령어
```bash
# 전체 포맷팅
npx prettier --write "packages/frontend/src/**/*.{ts,tsx}" "packages/backend/src/**/*.ts"
```
