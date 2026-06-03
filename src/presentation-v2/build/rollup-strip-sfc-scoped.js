/**
 * Strip Vue SFC scoped style markers from the production bundle.
 *
 * UI v2 class names are Acu-prefixed and the app is mounted in its own root, so
 * the generated data-v-* attributes are bundle-size overhead for CDN users.
 */
const V2_VUE_FILE_REGEX = /(?:^|[/\\])src[/\\]presentation-v2[/\\].+\.vue$/;
const STYLE_TAG_REGEX = /<style\b([^>]*)>/g;
const SCOPED_ATTR_REGEX = /\s+scoped(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;

export default function stripSfcScopedStyles() {
  return {
    name: 'acu-strip-sfc-scoped-styles',
    enforce: 'pre',
    transform(code, id) {
      if (!V2_VUE_FILE_REGEX.test(id)) return null;
      if (!/<style\b[^>]*\bscoped\b/.test(code)) return null;

      const next = code.replace(STYLE_TAG_REGEX, (tag, attrs) => {
        if (!/\bscoped\b/.test(attrs)) return tag;
        return `<style${attrs.replace(SCOPED_ATTR_REGEX, '')}>`;
      });

      return next === code ? null : { code: next, map: null };
    },
  };
}
