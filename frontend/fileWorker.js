const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

self.onmessage = async (event) => {
  const { fileData } = event.data;

  try {
    const decodedData = new Uint8Array(fileData.data);
    const totalChunks = Math.ceil(decodedData.length / CHUNK_SIZE);
    let result = '';

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min((i + 1) * CHUNK_SIZE, decodedData.length);
      const chunk = decodedData.subarray(start, end);

      if (fileData.content_type.startsWith('image/')) {
        result += String.fromCharCode.apply(null, chunk);
      } else if (fileData.content_type.startsWith('text/')) {
        result += new TextDecoder().decode(chunk);
      } else {
        // For other file types, we'll create a Blob and return its URL
        const blob = new Blob([decodedData], { type: fileData.content_type });
        result = URL.createObjectURL(blob);
        break; // No need to process in chunks for blob URL
      }

      // Report progress
      self.postMessage({ type: 'progress', data: Math.round(((i + 1) / totalChunks) * 100) });
    }

    if (fileData.content_type.startsWith('image/')) {
      const base64 = btoa(result);
      result = `data:${fileData.content_type};base64,${base64}`;
    }

    self.postMessage({ type: 'result', data: result });
  } catch (error) {
    self.postMessage({ type: 'error', data: error.message });
  }
};
