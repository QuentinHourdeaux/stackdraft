import { assertEquals } from "@std/assert";
import {
  isCssHexColor,
  normalizeCssHexColor,
} from "../api/lib/validation/color.ts";

Deno.test("isCssHexColor accepts exact CSS hex colors", () => {
  assertEquals(isCssHexColor("#aabbcc"), true);
  assertEquals(isCssHexColor("#AABBCC"), true);
});

Deno.test("isCssHexColor rejects non-CSS-hex colors", () => {
  assertEquals(isCssHexColor("aabbcc"), false);
  assertEquals(isCssHexColor("#abc"), false);
  assertEquals(isCssHexColor("#aabbccdd"), false);
  assertEquals(isCssHexColor("#ggbbcc"), false);
});

Deno.test("normalizeCssHexColor stores hex colors lowercase", () => {
  assertEquals(normalizeCssHexColor("#AABBCC"), "#aabbcc");
});
