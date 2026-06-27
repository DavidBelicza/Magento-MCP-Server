# syntax=docker/dockerfile:1

FROM ghcr.io/ggml-org/llama.cpp:server AS upstream

FROM ubuntu:24.04

RUN apt-get update \
  && apt-get install -y --no-install-recommends libgomp1 libssl3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=upstream /app /app
ENV LD_LIBRARY_PATH=/app

ARG GGUF_REPO=ggml-org/embeddinggemma-300m-qat-q8_0-GGUF
ARG GGUF_FILE=embeddinggemma-300m-qat-Q8_0.gguf

# Pin the model to an immutable HuggingFace commit + verify its checksum so every
# build gets byte-identical weights (no silent drift). To update: bump both lines.
ARG GGUF_REVISION=66f974f8cd48cc3b9c41c516b95508e75b4bee64
ADD --checksum=sha256:6fa0c02a9c302be6f977521d399b4de3a46310a4f2621ee0063747881b673f67 \
  https://huggingface.co/${GGUF_REPO}/resolve/${GGUF_REVISION}/${GGUF_FILE} /models/embedder.gguf

# Unpinned alternative (tracks the latest upstream file; not reproducible):
# ARG GGUF_REVISION=main
# ADD https://huggingface.co/${GGUF_REPO}/resolve/${GGUF_REVISION}/${GGUF_FILE} /models/embedder.gguf

EXPOSE 8080

ENTRYPOINT ["/app/llama-server"]
CMD ["-m", "/models/embedder.gguf", "--host", "0.0.0.0", "--port", "8080", "--embeddings", "--ctx-size", "2048"]
