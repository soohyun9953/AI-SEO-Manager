/**
 * 클라이언트 사이드 이미지 최적화 및 압축 유틸리티
 * 
 * Vercel Serverless Function의 4.5MB Payload 제한(FUNCTION_PAYLOAD_TOO_LARGE, 413)을
 * 방지하기 위해, 브라우저 캔버스를 통해 고해상도 이미지를 AI 분석에 최적인 크기(1280px)와
 * 고품질 JPEG(0.8)로 스마트 압축합니다.
 */

export interface 압축_결과 {
  data_url: string;
  file_size_str: string;
}

export const compress_image_file = async (
  file: File,
  max_dimension: number = 1280,
  quality: number = 0.8
): Promise<압축_결과> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 압축할 수 있습니다."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지 로드에 실패했습니다."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // 원본 비율 유지하면서 최대 해상도 이내로 축소
        if (width > max_dimension || height > max_dimension) {
          if (width > height) {
            height = Math.round((height * max_dimension) / width);
            width = max_dimension;
          } else {
            width = Math.round((width * max_dimension) / height);
            height = max_dimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // 캔버스 미지원 시 원본 반환
          const fallback_url = e.target?.result as string;
          resolve({
            data_url: fallback_url,
            file_size_str: (file.size / 1024).toFixed(1) + " KB",
          });
          return;
        }

        // 고화질 부드러운 리사이징
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG 0.8 품질로 변환 (용량 80~90% 절감, 시각적 품질 우수)
        const compressed_data_url = canvas.toDataURL("image/jpeg", quality);

        // 실제 base64 크기 계산
        const header_len = "data:image/jpeg;base64,".length;
        const base64_len = compressed_data_url.length - header_len;
        const approx_bytes = Math.round((base64_len * 3) / 4);
        const file_size_str = (approx_bytes / 1024).toFixed(1) + " KB (최적화)";

        resolve({
          data_url: compressed_data_url,
          file_size_str,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
