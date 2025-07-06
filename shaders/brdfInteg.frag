#version 410 core
out vec4 outColor;
const float PI = 3.141592;
in vec2 texCoord;

vec3 ImportanceSampleGGX(vec2 Xi, float a)
{
	
	float Phi=2*PI*Xi.x;
	float CosTheta=sqrt((1-Xi.y)/(1+(a*a-1)*Xi.y));
	float SinTheta=sqrt(1-CosTheta*CosTheta);

	vec3 H=vec3(SinTheta*cos(Phi),SinTheta*sin(Phi),CosTheta);

	return H;

}

const int nSamples=30;

float X(float v)
{
	return v>=0?1:0;
}
vec3 integrateIBL(float a,float NoV)
{
	vec3 sum =vec3(0);
	for (int i=0; i<nSamples; i++)
	{
		for(int j=0; j<nSamples; j++)
		{
			vec2 p=vec2(i/float(nSamples),j/float(nSamples));
			
			vec3 N = vec3(0,0,1);
			vec3 h = ImportanceSampleGGX(p,a);
			vec3 l= 2*dot(N,h)*h-N;
			
			vec3 v = vec3(sqrt(1-NoV*NoV),0,NoV);
			
			float VoH =dot(v,h);
			float NoH =h.z;
			float tn2= (1-NoV*NoV)/(NoV*NoV);
			float G = X(VoH/NoV)*(2/(1+sqrt(1+a*a*tn2)));

			float f_c =pow(1-VoH,5);
			
			sum+=vec3(1-f_c,f_c,0)*G*VoH/(NoH*NoV);
		}

	}

	return sum/float(nSamples*nSamples);
}


void main()
{
	vec3 color = integrateIBL(texCoord.y,texCoord.x);
	
	outColor=vec4(color,1);
}	