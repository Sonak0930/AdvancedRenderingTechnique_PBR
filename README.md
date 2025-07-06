# OpenGL을 활용한 PBR 렌더러 구현
핵심 기술: c/c++, OpenGL, GLSL, PBR, Image-Based Lighting, BRDF ...

### 코드 공개 범위 안내
본 프로젝트는 아주대학교 신현준 교수님의 고급 렌더링 특론 강의의 일환으로 진행되었습니다.
제공된 c++ 프레임워크의 저작권을 존중하기 위해 제가 작성한 GLSL 쉐이더 코드만 공개합니다.
따라서 전체 프로젝트의 빌드 및 실행은 불가능하지만, 이 README를 통해 구현된 기술의 핵심 결과물과 상세 원리를 확인하실 수 있습니다.

### 프로그램 사용 안내
쉐이더는 GLSL로 작성되었기 때문에, 프로그램 빌드를 위해서는 OpenGL 라이브러리를 사용해야 합니다.
1. hdr 텍스처를 읽고 로드하는 기능
2. 여러 종류의 쉐이더 프로그램을 작성
3. 렌더링 된 텍스처를 다음 쉐이더의 인풋으로 사용
등 생각보다 구현이 복잡한 사항이 많아 일단은 GLSL만 공개하겠습니다.

### Technical Page 
쉐이더 코드 설명 및 개념 설명을 위해 별도의 페이지를 마련했습니다.
README에 다 담기에는 방대한 양이라 양해부탁드립니다.

https://github.com/Sonak0930/AdvancedRenderingTechnique_PBR/blob/main/TECHPAGE.md

### 개관
https://github.com/user-attachments/assets/7e2bbe5f-9f7e-4b1e-8a21-551772d41ce1

### Specular Option
![0 NoSpecular](https://github.com/user-attachments/assets/cff400dd-7878-4cc5-85a9-e5cb496fd079)

0번째: No Specular
Specular Lighting을 고려하지 않은 결과입니다. 
Specular는 이미지에서 Highlight를 반짝반짝하게 만드는 효과가 있습니다.
현재 이미지에서 반짝 거리는 것은 Specular가 아니라 이미지 자체에 있는 빛을 그대로 렌더링해서 보이는 결과입니다.

![0 BlinnPhong](https://github.com/user-attachments/assets/d2726fb8-b6df-42ba-b33e-eab22f112336)

1번째: Blinn-Phong Shading 
Blinn-Phong Shading으로 Specular Light를 더한 결과입니다.
0번째와 비교했을때, 토끼 귀가 접히는 부분에서 하이라이트가 반짝반짝한 것을 볼 수 있습니다.

![0 GGX](https://github.com/user-attachments/assets/953181e0-4b0c-43f7-995b-21fd67a136e8)

2번째: GGX-Distribution
GGX Distribution을 이용해 Specular를 계산한 결과입니다.


