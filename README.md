# OpenGL을 활용한 PBR 렌더러 구현
핵심 기술: c/c++, OpenGL, GLSL, PBR, Image-Based Lighting, BRDF ...

## 목차
* [코드 저작권](#코드-저작권)
* [이론적 배경](#이론적-배경)
    * [PBR 소개](#PBR-소개)
    * [렌더링 방정식](#BRDF)
    * [Diffuse Material](#Diffuse-Material)
    * [Microfacet Model](#Microfacet-Model)
    * [Oren-Nayar Diffuse Reflection](#Oren-Nayar-Diffuse-Reflection)
    * [Specular BRDF](#Specular-BRDF)
    * [Fresnel](#Fresnel)
    * [Schlick's Approximation](#Schlick's-Approximation)
    * [Blinn-Phong Specular](#Phong-&-Blinn-Phong-Specular-BRDF)
    * [Cook-Torrance](#Cook-Torrance-Model)
* [코드 구조](#코드-구조)
* [구현 결과 (Visual Snippets)](#구현-결과-visual-snippets)
* [설치 및 실행](#설치-및-실행)
* [기여 방법](#기여-방법)

# 코드 저작권
본 프로젝트는 아주대학교 신현준 교수님의 고급 렌더링 특론 강의의 일환으로 진행되었습니다.
제공된 c++ 프레임워크의 저작권을 존중하기 위해 제가 작성한 GLSL 쉐이더 코드만 공개합니다.
따라서 전체 프로젝트의 빌드 및 실행은 불가능하지만, 이 README를 통해 구현된 기술의 핵심 결과물과 상세 원리를 확인하실 수 있습니다.

# 이론적 배경

# PBR 소개
PBR은 Physically Based Rendering의 약어로 빛과 표면의 물리적인 성질을 이용해 더욱 실사같은 렌더링을 하는 테크닉입니다.
기존의 Blinn-Phong Shading의 경우 물체의 normal, view dir, 그리고 light pos 세 개를 이용해서 물체를 렌더링 합니다.
이 방식의 경우 매끈한 표면의 일반적인 물체는 비슷하게 보입니다.
하지만 도체(electric or metal)와 부도체(dielctric)의 경우에는 꽤나 다릅니다.
도체는 들어온 빛을 대부분 거울반사(mirror-like reflection)를 하기 때문에 굉장히 날카롭고 선명한 하이라이트를 보입니다.
반면에 부도체는 표면 반사(subsurface-scattering)가 일어나기 때문에 투박하고, 빛이 퍼져보입니다.
이러한 물체의 특징들을 고려해서 새로운 렌더링 테크닉이 요구되었고, PBR은 이를 자세하게 다룹니다.

# BRDF
PBR을 시작하면서 가장 먼저 알아야 할 개념은 BRDF입니다. 
Blinn-Phong에서는 최종 PixelColor를 계산할 때 다음과 같은 방식을 사용합니다.
```
output.pixelColor = (diffuse + specular + ambient ) * attenuation
```

하지만 좀 더 물리적으로 사실적인 렌더링을 위해서, Output Color L_o를 다음과 같이 정의합니다.
![image](https://github.com/user-attachments/assets/f3d9e996-02f9-4f90-97aa-a5c818fbfcc1)

- 먼저 L_e 는 emission으로, 태양과 같은 뜨거운 물체가 스스로 내는 빛의 색을 의미합니다.
일반적으로 우리가 렌더링 할 오브젝트는 광원은 아니므로, 비워둡니다.

- Integral은 Monte-Carlo Integration에서 기반합니다.
자세한 내용은 필요하면 후술 하겠습니다.
간단하게 요약하자면, 한 pixel의 color를 결정하기 위해, pixel 위쪽 방향으로 반구(hemisphere)를 정의합니다.
그리고 hemisphere 안에 들어오는 빛들을 sampling 한 뒤에, 다 더해서 평균치를 내는 방식입니다.

  이 방식을 사용하면 울퉁불퉁한 굉장히 미세한 표면(microfacet)에서의 그림자, hemisphere 내부의  
  일부가 가리는 현상 또한 반영해서, pixel color를 결정할 수 있습니다.

- L_i는 incident light, 입사광의 색, 방향 등을 포함합니다.
모든 입사광은 우리가 관심있는 한 점으로 모인다고 가정합니다.

- cos(theta)는 cos factor로, incident light가 기울어진 각도로 들어오기 때문에,
normal 방향으로 들어올 때 보다 빛의 세기가 약해지게 됩니다. 이것을 반영해주는 factor입니다.

- dw는 integral시 sampling하는 굉장히 작은 steradian 하나 입니다. 이것들을 모두 더해서 integration에 사용합니다.

## Analytic BRDF
BRDF는 input light와 여러 정보를 받아 해당 지점의 색을 결정하는 함수입니다.
예를 들어 
```
f_r(x,wi,wo)
```
- wi는 incident light, wo는 outgoing light를 나타냅니다.

# Diffuse Material
Diffuse Material의 Analytic BRDF를 계산하기 전에, 간단하게 Diffuse Material의 특성에 대해 정리해 보겠습니다.
![image](https://github.com/user-attachments/assets/57de48dc-65b4-45e0-ac27-5c1810a88440)

Diffuse Material의 경우 빛이 들어오면 일부는 표면에서 바로 반사되어 나가고(Specular Reflection),
나머지는 물체 표면에서 여기저기 부딪히다 흡수되거나, 들어온 지점에서 displacement가 있는 다른 지점으로 반사됩니다.(diffuse reflection)

![image](https://github.com/user-attachments/assets/d7afe3ac-6269-4a87-ae1b-51b71fd85073)

그래서 diffuse Reflection을 모두 한 데 모으면, 이렇게 둥근 양상을 띱니다.

![image](https://github.com/user-attachments/assets/b86a1ad7-4cbb-4a3f-a0bf-64bbb9814e62)

diffuse material에 반사되어서 우리 눈으로 보이는 색을 Albedo라고 합니다.
이 색상은 실제 물체 색상인 diffuse Material에 PI를 곱한 값입니다.
그런데 강의 노트나 코드에서는 이 둘을 구분해서 사용하기 보다는, diffuse color 또는 albedo 하나의 개념으로 사용합니다.

## 코드
```
vec3 diffuseBRDF(vec3 w_i, vec3 w_o,vec3 N,vec3 albedo, vec3 F0, float a)
{
	vec3 reflectance = vec3(1);

	if(diffuseModel==0)
		reflectance =  vec3(0);
	else if(diffuseModel ==1)
		reflectance = vec3(OrenNayar(w_i,w_o,N,a,albedo))/dot(w_i,N);
	
	if(fresnelMode ==1)
		reflectance *= (vec3(1)-Fresnel(w_i,N,F0))/(vec3(1)-F0);

	return albedo/PI*reflectance;

}
```
diffuseBRDF는 3가지 옵션이 있습니다.

0: diffTex 이미지 컬러 사용 -> Shading 없이 기본 diffuse Texture의 이미지를 사용합니다.

1: OrenNayar 사용 

## diffuseTex 렌더링 결과
![image](https://github.com/user-attachments/assets/8575afae-6c36-45c8-9861-5106bdfdaf16)


### FresnelMode 사용 
이 코드는 사용한지 오래 되어 원문 소스를 찾지 못했습니다.
다만, 이 코드의 역할은 Fresnel을 Diffuse color에 적용해서 w_i에 따라 diffuse의 reflectance를 결정합니다.

![image](https://github.com/user-attachments/assets/70c10d0a-2808-42d8-80bf-0a98555f4583)

![image](https://github.com/user-attachments/assets/2e62148e-0b7d-4f2c-b83c-fb4c43a70b51)

incident light가 grazing angle인 경우, 해당 diffuse의 영향력은 0이 됩니다.

![image](https://github.com/user-attachments/assets/d9deda59-857e-4bf7-8f9e-5732429b697e)

incident light가 normal direction인 경우, diffuse의 영향력은 1로 유지됩니다.

이 코드의 소스를 찾기 위해 gemini를 사용했습니다. 
gemini는 Yoshiharu Gotanda의 GDC valult에서 소개된 diffuse Reflection 계산방법을 소개했는데,
해당 normalization 코드는 찾을 수가 없었습니다.

![image](https://github.com/user-attachments/assets/03e1cf26-0814-4518-9c97-02d798c155c6)
gemini의 의견에 따르면 F0를 사용할 때 의도치 않게 diffuse color가 어두워지는 현상이 발생합니다.
그래서 이를 막기 위한 장치로 보인다고 설명합니다.

아마 강의에서도 비슷한 이야기가 나왔을 거 같은데, 기록을 다른 곳에 해 놓았는지 관련한 내용을 찾기는 어려웠습니다.
추측컨대 원문(GDC)의 구현이 복잡한 이유로 간소화한 버전이 아닐까 생각하고 있습니다.


# Microfacet model
- 개요
조금 더 Realsitic한 표현을 위해, 물체 표면(surface)도 미세하게 조정할 필요가 있습니다.
실제 High Resolution 모델의 경우 CPU->GPU로 Load 하는 시간이 오래 걸리고, 메모리를 많이 차지합니다.
Microfacet model은 기존의 모델을 마치 Complex Model 처럼 렌더링해서 Realistic한 렌더링 결과를 만듭니다.
그리고 이 연산을 GPU에서 하기 때문에 상대적으로 부담이 적습니다.

# Oren-Nayar Diffuse Reflection
Oren-Nayar는 V-shaped microfacet model입니다. 
![image](https://github.com/user-attachments/assets/b01b55e4-4796-4bd2-8e66-0b0084b1d750)

검은색 면이 기존의 큰 면(Macrofacet)을 나타내고, 분홍색으로 칠해진 면들이 미세면(microfacet)을 나타냅니다.
Shading을 할 때는 microfacet 기준으로 하기 때문에, 기존의 macrofacet을 사용할 때보다 다양한 양상의 노멀(normal distribution)이 보입니다

## normal distribution
노멀들의 분포 양상을 분포 함수로 표현한 것입니다. 표준 편차(standard deviation)가 크다는 것은, 노멀들의 값이 골고루 나온다는 뜻이므로
물체 표면이 전체적으로 거칠게 표현됩니다. oren-nayar 에서는 표면의 거친 정도(roughness)를 standard deviation으로 설정해서
roughness가 클 수록 표면이 거칠게 렌더링됩니다.

![clay](https://github.com/user-attachments/assets/8d8eed2d-95dd-4ed8-a76d-9f9064c6e7c9)

https://www.freepik.com/psd/terracotta

## 한계
![image](https://github.com/user-attachments/assets/1da1f7a6-e560-47dc-88df-f8f4d07ff316)

Oren-Nayar는 subsurface scattering distance가 작은 material을 대상으로 적합합니다.

![image](https://github.com/user-attachments/assets/82fbb8a4-f812-4ae1-84a7-242bb4718143)

ref: https://www.sciencedirect.com/topics/computer-science/diffuse-surface

위 ref에서 설명하듯이, oren-nayar의 surface는 lambertian이기 때문에 다음과 같은 사항들을 고려하지 않습니다.
- inter-reflection(반사되어 나온 빛이 다른 facet에 부딪히는 현상)
- shadowing (다른 facet에 의해 빛이 도달하지 못함)
- masking (반사된 빛이 다른 facet에 차단되어서 우리 눈으로 들어오지 못함)


## 코드
```
vec3 OrenNayar(vec3 w_i, vec3 w_o, vec3 N , float a2, vec3 albedo)
{
	float cosTi=dot(w_i,N);
	float cosTr = dot(w_o,N);
	float thetaI=acos(cosTi);
	float thetaR=acos(cosTr);
	float cosPhi=dot(normalize(w_i-N*cosTi),normalize(w_o-N*cosTr));
	float alpha=max(thetaI,thetaR);
	float beta=min(thetaI,thetaR);
	float sigmaa=a2/(a2+0.09);
	float C1=1-0.5*a2/(a2+0.33);
	float C2=0.45*sigmaa*(cosPhi>=0?sin(alpha):(sin(alpha)-pow(2*beta/PI,3)));
	float C3=0.125*sigmaa*pow(4*alpha*beta/(PI*PI),2);
	float L1 = cosTi*(C1+C2*cosPhi*tan(beta)+C3*(1-abs(cosPhi))*tan((alpha+beta)/2));
	vec3 L2 = 0.17*albedo*cosTi*(a2/(a2+0.13))*(1-cosPhi*pow(2*beta/PI,2));
	return vec3(L1)+L2;
}
```

![image](https://github.com/user-attachments/assets/0a53fcfb-eb11-479f-b273-91ed74e5125c)

출처:[wikipedi](https://en.wikipedia.org/wiki/Oren%E2%80%93Nayar_reflectance_model)

해당 코드는 Oren-Nayar Model의 수식을 code로 옮긴 것입니다. 
theta_i와 theta_r로는 각각 w_i(incident light), w_o(reflected light)이 사용됩니다.

## 렌더링 결과
https://github.com/user-attachments/assets/666b4d86-b0ac-4d0c-819a-c66741b3444d

roughness가 낮을 때는 매끈한 표면이지만, roughness가 올라가면 점토처럼 딱딱하고 거친 느낌을 주는 것을 확인할 수 있습니다.



# Specular BRDF
지금까지 Diffuse BRDF를 계산했으니, Specular BRDF도 구해보겠습니다.

# Fresnel
Specular는 Diffuse와 다르게 Fresnel의 영향을 받습니다.
발 밑의 바다를 보면 물 속에 뭐가 있는지 훤히 보이지만,
먼 거리에 있는 바다를 보면 푸른 빛만 반사되는 현상을 보신 적이 있을 겁니다.

이 현상은 빛의 '편광'(Polarization)때문에 일어납니다.

[아래 내용은 wikipedia를 참고해서 작성되었습니다.]

빛이 서로 다른 매질의 경계면에 부딪힐 때, 빛의 전기장 방향이 입사면(incident plane)에 대해 수직인지 평행인지에 따라
반사 및 투과율이 달라집니다.

- S-편광(S-Polarization)

빛의 전기장이 입사면에 대해 수직인 경우 입니다. 강의노트에서는 R_s로 notation이 되어 있습니다.
입사각이 변함에 따라 점차 반사율이 증가합니다.

- P-편광(P-Polarization)

  빛의 전기장이 입사면과 평행한 경우 입니다. R_p로 notation이 되어 있습니다.

![image](https://github.com/user-attachments/assets/1dc9d7f7-290d-4174-8a9c-0ff9ad06c6b2)

이미지를 보면 좀 더 이해하기가 쉽습니다. 
이 사진은 카메라의 편광 필터 방향이 서로 반대인 상황입니다.
- 왼쪽 사진

왼쪽 사진에서는 polarizer의 방향이 세로 방향이라, 카메라의 필터와 R_p가 일치하기 때문에
강한 반사가 일어납니다.

- 오른쪽 사진

오른쪽 사진은 가로 방향의 필터를 사용해 R_p가 0이 되도록 만들었습니다.
그래서 Reflection이 아니라 Transmission이 일어나서 빛이 투과됩니다.
![image](https://github.com/user-attachments/assets/dc515a0c-0dfc-41f5-9de7-2b2413d9498f)

위 그래프는 각도에 따른 Rs와 Rp, 그리고 Ts와 Tp의 변화 양상을 나타냅니다.
R은 Reflection, T는 Transmission을 나타냅니다.
간단하게만 설명하자면, 특정 incident angle을 기준으로 Transmission보다 Reflection이 커집니다.

따라서 incident angle에 따라 reflection color를 다르게 계산할 필요가 있습니다.

# Schlick's Approximation
실제로 Rs와 Rp로 R을 계산하는 과정은 꽤나 복잡하기 때문에, Schlick이라는 사람의 간단한 버전을 사용하도록 했습니다.

![image](https://github.com/user-attachments/assets/0c8f95ee-51d3-4bfd-a0c2-e2f51a7f1626)

간단하게만 설명하자면, normal angle과 stiff angle에서 각각 물체의 specular color를 결정합니다.
F(theta)는 incident angle=theta일 때 Fresnel Factor를 나타냅니다.

F0는 물체의 Mirror-like reflection 색상입니다.
Dielctric의 경우에는 흰색(부도체의 경우 굉장히 강한 빛을 쏘면 물체의 diffuse color가 날아가고, 물체가 흰색으로 변하는 현상이 있습니다.)
electric의 경우에는 물체의 고유한 specular color가 반사됩니다.

# Phong & Blinn-Phong Specular 
본격적으로 Specular BRDF를 구해 보겠습니다.

## Phong Specular 
```
R = reflect(N-L)
```
빛의 반사 방향(R)이 N(surface normal)과 L(incident light)의 perfect mirror reflection이라고 가정합니다.
그리고 이 R은 V(viewing angle)과 비슷할 수록 Specular reflection이 강해지게 됩니다.

![image](https://github.com/user-attachments/assets/3f7d89d6-a7e0-4468-9584-4a3d959de4b7)

https://github.com/user-attachments/assets/ff77f80e-3e9e-4c18-80d3-46706c8af097
Phong Specular 결과입니다.

## Phong & BlinnPhong model의 한계
![image](https://github.com/user-attachments/assets/d4f41fe0-e0f8-4ad9-926a-5752e23c78fe)

[src]:https://boksajak.github.io/files/CrashCourseBRDF.pdf

해당 pdf의 8페이지를 보면, Blinn-phong은 물리적으로 정확하지 않기 때문에 BRDF라고 표기하지 않는다고 되어있습니다.
BRDF로 정의되기 위해서는 2가지 성질이 필요합니다.

![image](https://github.com/user-attachments/assets/7b2c6a09-d0ed-417c-9002-2f5b074f4714)

분량상의 문제로 두 개념을 자세하게 다루기는 어렵습니다.
Phong은 2가지를 만족하지 못하지만 계산이 빠르고 그럴듯한 결과를 내기 때문에 포함시켰습니다.


# Cook-Torrance Model
위에서 언급한 Phong모델의 물리적인 불완전성 때문에, Cook과 Torrance가 제시한 새로운 모델을 사용합니다.

![image](https://github.com/user-attachments/assets/e6e7dffd-8e87-4168-b58a-161c35f8c44e)

특이점이라면, 함수가 gaussian의 형태를 띈다는 점입니다.
그리고 roughness*roughness를 사용해서, 유저가 값을 변경했을 때 변화가 두드러지게 나타나도록 했습니다.

![0 BlinnPhong](https://github.com/user-attachments/assets/d2726fb8-b6df-42ba-b33e-eab22f112336)
 
토끼 귀가 접히는 부분에서 하이라이트가 반짝반짝한 것을 볼 수 있습니다.

![0 GGX](https://github.com/user-attachments/assets/953181e0-4b0c-43f7-995b-21fd67a136e8)

2번째: GGX-Distribution
GGX Distribution을 이용해 Specular를 계산한 결과입니다.


