let processedData = null;
let processedDataType = null;

self.onmessage = async (event) => {
  const { type, data, contentType, isLastChunk } = event.data;

  if (type === 'chunk') {
    try {
      if (!processedData) {
        processedData = new Uint8Array(0);
        processedDataType = contentType;
      }

      const newData = new Uint8Array(processedData.length + data.length);
      newData.set(processedData);
      newData.set(new Uint8Array(data), processedData.length);
      processedData = newData;

      self.postMessage({ type: 'progress', data: Math.round((processedData.length / (10 * 1024 * 1024)) * 100) });

      if (isLastChunk) {
        let result;
        if (contentType.startsWith('image/')) {
          const base64 = btoa(String.fromCharCode.apply(null, processedData));
          result = `data:${contentType};base64,${base64}`;
        } else if (contentType.startsWith('text/')) {
          result = new TextDecoder().decode(processedData);
        } else {
          const blob = new Blob([processedData], { type: contentType });
          result = URL.createObjectURL(blob);
        }

        self.postMessage({ type: 'result', data: result });
        processedData = null;
        processedDataType = null;
      }
    } catch (error) {
      self.postMessage({ type: 'error', data: error.message });
      processedData = null;
      processedDataType = null;
    }
  }
};
