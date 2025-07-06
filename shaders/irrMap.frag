#version 410 
const float PI = 3.141592;
in vec2 texCoord;
uniform float roughness;
uniform sampler2D srcIBL;

out vec4 outColor;
vec3 angleToNormal(vec2 pt)
{
	vec3 v;
	v.x=cos(pt.x)*cos(pt.y);
	v.y=sin(pt.y);
	v.z=sin(pt.x)*cos(pt.y);

	return v;
}

vec2 texCoordToAngle(vec2 texCoord)
{
	return vec2((1-texCoord.x)*(2*PI),(0.5-texCoord.y)*PI);
}

vec2 vecToAngle(vec3 r)
{
	float theta= atan(r.z,r.x);
	float phi = atan(r.y,length(r.xz));
	return vec2(theta,phi);
}

vec2 angleToTexCoord(vec2 pt)
{
	return vec2(1-pt.x/(2*PI),0.5-pt.y/PI);
}

vec3 ImportanceSampleGGX(vec2 Xi, float a, vec3 N)
{
	
	float Phi=2*PI*Xi.x;
	float CosTheta=sqrt((1-Xi.y)/(1+(a*a-1)*Xi.y));
	float SinTheta=sqrt(1-CosTheta*CosTheta);

	vec3 H=vec3(SinTheta*cos(Phi),SinTheta*sin(Phi),CosTheta);

	float cosb = N.z;
	float sinb=length(N.xy);
	vec3 k = normalize(cross(vec3(0,0,1),N));
	return H*cosb+cross(k,H)*sinb+k*dot(k,H)*(1-cosb);

	
	
}

const int nSamples =10;

vec3 integrateIBL(vec3 N,float roughness)
{
	float a = roughness;
	vec3 sum =vec3(0);
	float wsum=0;
	for (int i=0; i<nSamples; i++)
	{
		for(int j=0; j<nSamples; j++)
		{
			vec2 p=vec2(i/float(nSamples),j/float(nSamples));
			vec3 h = ImportanceSampleGGX(p,a,N);
			vec3 l= 2*dot(N,h)*h-N;
			vec3 Li= texture(srcIBL,angleToTexCoord(vecToAngle(l))).rgb;
			float w=dot(N,Li);
			sum += Li*w;
			wsum += w;
		}

	}

	return sum/wsum;
}
void main()
{
	float a = roughness*roughness;
	vec3 color = integrateIBL(angleToNormal(texCoordToAngle(texCoord)),a);
	outColor=vec4(color,1);
}