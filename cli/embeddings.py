"""Local sentence embeddings; article text never leaves this process."""
import json
import sys


def main():
    from sentence_transformers import SentenceTransformer
    texts = json.load(sys.stdin)
    options = dict(revision='e8f8c211226b894fcb81acc59f3b34ba3efd5f42', device='cpu')
    name = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
    try:
        model = SentenceTransformer(name, local_files_only=True, **options)
    except OSError:
        # Download only when the pinned model is missing from the local cache.
        model = SentenceTransformer(name, **options)
    lengths = [len(model.tokenizer.encode(text)) for text in texts]
    if max(lengths, default=0) > model.max_seq_length:
        raise ValueError('A sentence exceeds the model token limit; shorten the sample. No text was silently truncated.')
    vectors = model.encode(texts, batch_size=24, normalize_embeddings=True, show_progress_bar=False)
    json.dump(vectors.tolist(), sys.stdout)


if __name__ == '__main__':
    main()
