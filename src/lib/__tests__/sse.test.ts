import { describe, it, expect } from "vitest";
import { makeSSEStream } from "../sse";

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value);
  }
  return result;
}

describe("makeSSEStream", () => {
  describe("when sending events and closing", () => {
    it("should produce SSE-formatted output", async () => {
      const { stream, send, close } = makeSSEStream<{ type: string; msg: string }>();
      send({ type: "progress", msg: "hello" });
      send({ type: "done", msg: "world" });
      close();

      const output = await readAll(stream);
      expect(output).toContain('data: {"type":"progress","msg":"hello"}');
      expect(output).toContain('data: {"type":"done","msg":"world"}');
    });

    it("should separate events with double newlines", async () => {
      const { stream, send, close } = makeSSEStream<string>();
      send("a");
      send("b");
      close();

      const output = await readAll(stream);
      const events = output.split("\n\n").filter(Boolean);
      expect(events).toHaveLength(2);
    });
  });

  describe("when sending after close", () => {
    it("should not throw", async () => {
      const { stream, send, close } = makeSSEStream<string>();
      close();
      // Should silently no-op
      expect(() => send("after-close")).not.toThrow();

      const output = await readAll(stream);
      expect(output).not.toContain("after-close");
    });
  });

  describe("when closing twice", () => {
    it("should not throw", async () => {
      const { stream, close } = makeSSEStream<string>();
      close();
      expect(() => close()).not.toThrow();

      await readAll(stream);
    });
  });

  describe("when the reader cancels the stream before a send", () => {
    it("should silently mark as closed", async () => {
      const { stream, send } = makeSSEStream<string>();
      const reader = stream.getReader();
      await reader.cancel();
      // send after reader cancelled — should catch internally and set closed=true
      expect(() => send("after-cancel")).not.toThrow();
      // Subsequent sends should also be silent no-ops
      expect(() => send("another")).not.toThrow();
    });
  });

  describe("when sending complex objects", () => {
    it("should JSON-serialize correctly", async () => {
      const { stream, send, close } = makeSSEStream<{ nested: { arr: number[] } }>();
      send({ nested: { arr: [1, 2, 3] } });
      close();

      const output = await readAll(stream);
      expect(output).toContain('"nested":{"arr":[1,2,3]}');
    });
  });
});
