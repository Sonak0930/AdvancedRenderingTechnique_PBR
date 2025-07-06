#version 410
layout(location=0) in vec3 inPosition;
layout(location=2) in vec2 inTexCoord;
uniform mat4 modelMat;
out vec2 texCoord;
void main(void) {
	vec4 world_Pos = modelMat* vec4( inPosition, 1. );
	gl_Position= world_Pos;
	texCoord = vec2( inTexCoord.x, 1.-inTexCoord.y );
}