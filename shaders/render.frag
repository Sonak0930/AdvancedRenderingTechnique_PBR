#version 410 core
out vec4 outColor;
const float PI = 3.1415926535;
vec3 lightColor = vec3(1,1,1);
in vec3 normal;
in vec3 worldPos;
in vec2 texCoord;

uniform vec2 viewport;
uniform sampler2D diffTex;
uniform sampler2D normalTex;
uniform sampler2D armTex;
uniform sampler2D emissionTex;
uniform int  diffTexEnabled=0;
uniform int armTexEnabled=0;
uniform int normalTexEnabled;
uniform int emissionTexEnabled;
uniform vec3 lightPosition;
uniform vec3 cameraPosition;
uniform float roughness=0.3f;
uniform float shineness;
uniform int specularModel;
uniform vec3 F0=vec3(0.039);
uniform int fresnelMode =0;
uniform int diffuseModel=0;
uniform float metal=0.0f;
uniform float ambientLight=0.3;
uniform sampler2D ibl;
uniform sampler2D irrMap;
uniform float lightFactor;
uniform sampler2D srcIBL;
uniform sampler3D envMap;
uniform sampler2D brdfMap;

float distribution(vec3 w_i, vec3 w_o, vec3 N,float r)
{
	vec3 H = normalize((w_i+w_o)/2);
	float a = r*r;
	float theta = acos(dot(N,H));
	return a*a/(PI*pow(cos(theta),4)*pow(a*a+pow(tan(theta),2),2));
}


vec3 PhongBRDF(vec3 w_i, vec3 w_o, vec3 N)
{
	vec3 R = 2*dot(N,w_i)*N-w_i;
	return vec3(1)*(shineness+1)/(2*PI)*pow(max(0,dot(R,w_o)),shineness);
}

vec3 Lambertian(vec3 w_i, vec3 w_o, vec3 albedo)
{
	return albedo/PI;
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





//***************************************************
//            Color Space Conversion Functions
//***************************************************
float tonemap_sRGB(float u) {
	float u_ = abs(u);
	return  u_>0.0031308?( sign(u)*1.055*pow( u_,0.41667)-0.055):(12.92*u);
}
vec3 tonemap( vec3 rgb, mat3 csc, float gamma ){
	vec3 rgb_ = csc*rgb;
	if( abs( gamma-2.4) <0.01 ) // sRGB
		return vec3( tonemap_sRGB(rgb_.r), tonemap_sRGB(rgb_.g), tonemap_sRGB(rgb_.b) );
	return sign(rgb_)*pow( abs(rgb_), vec3(1./gamma) );
}
float inverseTonemap_sRGB(float u) {
	float u_ = abs(u);
	return u_>0.04045?(sign(u)*pow((u_+0.055)/1.055,2.4)):(u/12.92);
}
vec3 inverseTonemap( vec3 rgb, mat3 csc, float gamma ){
	if( abs( gamma-2.4) <0.01 ) // sRGB
		return csc*vec3( inverseTonemap_sRGB(rgb.r), inverseTonemap_sRGB(rgb.g), inverseTonemap_sRGB(rgb.b) );
	return csc*sign(rgb)*pow( abs(rgb), vec3(gamma) );
}



float geometry(vec3 w_i,vec3 w_o,vec3 N)
{
	vec3 H = normalize((w_i+w_o)/2);
	return min(min(1,2*dot(N,H)*dot(N,w_o)/dot(w_o,H)),2*dot(N,H)*dot(N,w_o)/dot(w_o,H));
}

vec3 Fresnel(vec3 w_i,vec3 N,vec3 F0)
{
return mix(F0,vec3(1),pow(1-max(0,dot(w_i,N)),5));
}


vec3 BlinnPhongDistribution(vec3 w_i, vec3 w_o, vec3 N, float r)
{
	float a= r*r;
	float k = 2/(a*a)-2;
	vec3 H = normalize((w_i+w_o)/2);
	return vec3(1)*(k+1)/(2*PI)*pow(max(0,dot(N,H)),k);
}

vec3 CookTorrance(vec3 w_i, vec3 w_o, vec3 N,float r)
{
	float D=distribution(w_i,w_o,N,r);
	float G=geometry(w_i,w_o,N);
	vec3 F=Fresnel(w_i,N,F0);
	
	return D*G*F/(4*dot(w_i,N)*dot(w_o,N));

}
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


mat3 getTBN(vec3 N)
{
	vec3 Q1 = dFdx(worldPos),Q2=dFdy(worldPos);
	vec2 st1=dFdx(texCoord),st2=dFdy(texCoord);
	float D=st1.s*st2.t-st2.s*st1.t;

	vec3 a=normalize((Q1*st2.t-Q2*st1.t)*D);
	vec3 b=normalize((-Q1*st2.s+Q2*st1.s)*D);
	return mat3(a,b,N);
}
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

float GGXDistribution(vec3 w_i,vec3 w_o, vec3 N, vec3 H, float a )
{

	float aa=a*a;
	float theta=acos(dot(N,H));
	return aa/(PI*pow(cos(theta),4)* pow(aa+pow(tan(theta),2),2));

}

float GGXGeometry(vec3 w_i, vec3 w_o, vec3 N , vec3 H)
{
	/*
	GGXGeometry calculates the geometry term of lighting equation.
	dot product will be negatie when the vectors are facing in opposite direction,
	which would not make physical sense in the context of lighting calculations.
	-> you can not have light interaction on the back side of the surface.
	*/
	float NdotH=dot(N,H);
	float NdotV=dot(N,w_o);
	float VdotH=max(dot(w_o,H),0);
	float NdotL=dot(N,w_i);
	return min(min(1,2*NdotH*NdotV/VdotH),2*NdotH*NdotL/VdotH);	
	
	
}




//sample light based on Z=>N(world) direction.
vec3 ImportanceSampleGGX(vec2 Xi, float a, vec3 N)
{
	
	float Phi=2*PI*Xi.x;
	float CosTheta=sqrt((1-Xi.y)/(1+(a*a-1)*Xi.y));
	float SinTheta=sqrt(1-CosTheta*CosTheta);

	vec3 H=vec3(SinTheta*cos(Phi),SinTheta*sin(Phi),CosTheta);

	float cosb = N.z; // dot(N,Z)=N.z because Z = (0,0,1)
	float sinb=length(N.xy);
	vec3 k = normalize(cross(vec3(0,0,1),N)); // rotation axis with cross product.
	return H*cosb+cross(k,H)*sinb+k*dot(k,H)*(1-cosb); //rodrigue equation.

}
vec3 sampleIBL(vec3 r)
{	
	float theta= atan(r.z,r.x);
	float phi = atan(r.y,length(r.xz));
	vec2 uv = vec2(1-theta/(2*PI),0.5-phi/PI);

	return texture(ibl,uv).rgb*10000;
}



const int nSamples=50;


vec3 ibLighting(vec3 w_o,vec3 N, vec3 albedo, vec3 F0, float a, float metal)
{
	/*
	vec3 sum=vec3(0);
	for(int i=0; i<nSamples; i++)
	{
		for(int j=0; j<nSamples; j++)
		{
			vec2 p= vec2(i/float(nSamples),j/float(nSamples));		
			vec3 h = ImportanceSampleGGX(p,a,N);
			vec3 l = 2*dot(w_o,h)*h-w_o; //reflect( w_o,h);
			float phi = atan(l.y,length(l.xz));
			vec3 c = sampleIBL(l).rgb;
			
			//specular term
			float NdotL=dot(N,l);
			if(NdotL>0)
			{
				//sum+=c*cos(phi)*max(0,NdotL);
				vec3 specular=c*Fresnel(l,h,mix(F0,albedo,metal))/(4*dot(w_o,N))*GGXGeometry(l,w_o,N,h);
				sum+=specular;
			}
		}

		
			
	}

	return sum/nSamples/nSamples*2;
	
	*/
	vec3 R= reflect(-w_o,N);
	vec2 irrCoord = angleToTexCoord(vecToAngle(N));
	vec2 envCoord = angleToTexCoord(vecToAngle(R));
	vec3 diff= mix(albedo,vec3(0),metal)*texture(irrMap,irrCoord).rgb*lightFactor;
	vec3 spec = texture(envMap,vec3(envCoord,clamp(a,0.0,0.95))).rgb*lightFactor*0.1;
	vec3 brdf = texture(brdfMap,vec2(dot(N,w_o),a)).xyz;
	spec=spec*(mix(F0,albedo,metal)*brdf.x+brdf.y);
	return diff+spec;
	
}


vec3 brdfPoint(vec3 w_i, vec3 w_o, vec3 N,vec3 albedo,vec3 F0, float a, float metal)
{
	vec3 H = normalize((w_i+w_o)/2);
	
	//There are tiny mistake computing fresnel. 
	vec3 specular=Fresnel(w_i,H,mix(F0,albedo,metal))/(4*dot(w_i,N)*dot(w_o,N));

	
	switch(specularModel)
	{
		case 0:
			specular *=0;
			break;
		case 1:
			specular *= BlinnPhongDistribution(w_i,w_o,N,a);
			break;
		case 2:
			specular *= GGXDistribution(w_i,w_o,N,H,a);
			break;
		
	}
	
	vec3 r= reflect(-w_o,N);
	specular*=sampleIBL(r);
	return mix(diffuseBRDF(w_i,w_o,N,albedo,F0,a),vec3(0),metal)+specular*GGXGeometry(w_i,w_o,N,H);
	
}



void main() {
	vec3 faceN = normalize( cross( dFdx(worldPos), dFdy(worldPos) ) );
	vec3 N = normalize(normal);
	vec3 toLight = lightPosition-worldPos;
	vec3 w_i = normalize( toLight );
	vec3 w_o = normalize( cameraPosition - worldPos );
	if( dot(N,faceN) <0 ) N = -N;

	vec3 arm;
	vec4 emission=vec4(0);
	arm.r=1;
	arm.g=roughness;
	arm.b=metal;

	vec4 albedo = vec4(1);
	

	if( diffTexEnabled>0 ){
		albedo = texture( diffTex, texCoord);
	}
	
	if(armTexEnabled>0)
	{
		arm=texture(armTex,texCoord).rgb;
	}
	
	if(emissionTexEnabled>0)
	{
		emission=texture(emissionTex,texCoord);
	}

	mat3 tbn = getTBN(N);
	if(normalTexEnabled>0)
	{
		N=normalize(tbn*(texture(normalTex,texCoord).rgb*2-vec3(1)));
	}

	
	albedo.rgb=inverseTonemap(albedo.rgb,mat3(1),2.4);
	vec3 Li = lightColor/dot(toLight,toLight);
	vec4 color=vec4(0,0,0,1);
	color.rgb = emission.rgb +brdfPoint(w_i,w_o,N,albedo.rgb,F0,arm.g*arm.g,arm.b) * Li * dot(N,w_i)+ambientLight*albedo.rgb*arm.r;
	
	color.a = albedo.a;
	
	
	//iblighting : diffuse + specular 
	color.rgb+= ibLighting(w_o,N,albedo.rgb,F0,arm.g*arm.g,arm.b);
	outColor = vec4(tonemap(color.rgb,mat3(1),2.4),color.a);
}

