window.onload = function() { init() }

function init() {

	var script = document.createElement('script');
		document.querySelector('#buttonClick').addEventListener('click', function() {
			var t05 = performance.now()
			var stageBuffers = compute.processStages()
			//if ( stageBuffers.length > 0 ) console.log( stageBuffers )
			t05f = performance.now() - t05
			t06 = performance.now()
			var renderBuffer = compute.renderOutput()
			//if ( renderBuffer.length > 0 ) console.log( renderBuffer )
			t06f = performance.now() - t06
			console.log("processStages\t\t", t05f,
						"\nrenderOutput\t\t", t06f)
	}, false);
	
	
	t01 = performance.now()
	var queue = new EventQueue()
	queue.register( 'resourcesLoader', resourcesLoaded, [this], 1 )
	loadShaderSources( queue )
}

var t01, t02, t03, t04, t05, t06, t07, t08
var t01f, t02f, t03f, t04f, t05f, t06f, t07f, t08f

var shaderSources = {}
var compute = new glCompute( "container" );

function loadShaderSources( callbackQueue ) {
	// Load Resources
	var queue = new EventQueue()
	queue.register( 'fileLoader', filesLoaded, [this], 6 )
	loadFile( "./js/vertStageA.glsl", handleRequest, [this, "vertStageA"] )
	loadFile( "./js/fragStageA.glsl", handleRequest, [this, "fragStageA"] )
	loadFile( "./js/vertStageB.glsl", handleRequest, [this, "vertStageB"] )
	loadFile( "./js/fragStageB.glsl", handleRequest, [this, "fragStageB"] )
	loadFile( "./js/vertRender.glsl", handleRequest, [this, "vertRender"] )
	loadFile( "./js/fragRender.glsl", handleRequest, [this, "fragRender"] )
	
	var shadersSrc = {}
	
	function handleRequest( caller, type, request ) {
		shadersSrc[type] = request.response
		queue.submit( 'fileLoader', type )
	}
	
	function filesLoaded( caller ) {
		shaderSources = shadersSrc
		callbackQueue.submit( 'resourcesLoader', 'resourcesLoaded' )
	}
	
}

function resourcesLoaded() {
	t01f = performance.now() - t01
	
	t02 = performance.now()
	compute.setupGL( 4, 3, 100 )
	t02f = performance.now() - t02
	
	t03 = performance.now()
	data = setupData()
	t03f = performance.now() - t03
	
	t04 = performance.now()
	setupShaders( data )
	t04f = performance.now() - t04
	
	t05 = performance.now()
	var stageBuffers = compute.processStages()
	//if ( stageBuffers.length > 0 ) console.log( stageBuffers )
	t05f = performance.now() - t05
	
	t06 = performance.now()
	var renderBuffer = compute.renderOutput()
	//if ( renderBuffer.length > 0 ) console.log( renderBuffer )
	t06f = performance.now() - t06
	
	t07 = performance.now()
	//compute.disposeStagesFBOs()
	t07f = performance.now() - t07
	
	tfinal = performance.now() - t01
	
	console.log("\nresourceLoader\t\t", t01f,
				"\nsetupGL\t\t\t\t", t02f,
				"\nsetupData\t\t\t", t03f,
				"\nsetupShaders\t\t", t04f,
				"\nprocessStages\t\t", t05f,
				"\nrenderOutput\t\t", t06f,
				"\ndisposeStagesFBOs\t", t07f,
				/*"\nrenderOutput\t\t", t08f,*/
				"\nTOTAL\t\t\t\t", tfinal)
}

var inputs
function setupData() {
	var gl = compute.gl
	
	compute.outputElementSize = 4
	
	var inputElementSize = 4
	var inputWidth = compute.width
	var inputHeight = compute.height
	
	var inputA = new Float32Array( inputWidth * inputHeight * inputElementSize )
	var c = 0.1//(1 / (compute.width*compute.height));
	for ( var i = 0; i < inputWidth * inputHeight * inputElementSize; i++ ) {
		inputA[i*4 + 0] = c
		inputA[i*4 + 1] = c//-1.0//(i % 4 == 3) ? 0.5 : 0.0
		inputA[i*4 + 2] = c//-1.0
		inputA[i*4 + 3] = 1.0//-1.0
		c += 0.05
	}
	
	//var matrixA = nd.array(inputA, [inputWidth, inputHeight, inputElementSize])
	
	var inputB = new Float32Array( inputWidth * inputHeight )
	var c = 0//.001;
	for ( var i = 0; i < inputHeight; i++ ) {
		for ( var j = 0; j < inputWidth; j++ ) {
			inputB[i * inputWidth + j + 0] = c// + 0.25
			c += 1//(1 / (inputWidth * inputHeight))
		}
	}
	
	//var matrixB = nd.array(inputB, [inputWidth, inputHeight])
	
	var inputC = new Float32Array( inputWidth * inputHeight * 1 )
	var c = 0
	for ( var i = 0; i < inputWidth * inputHeight * 1; i++ ) {
		inputC[i] = c
		c += 0.05
	}
	
	var inputD = new Float32Array( inputWidth * inputHeight * 1 )
	var c = 1
	for ( var i = 0; i < inputWidth * inputHeight * 1; i++ ) {
		inputD[i] = c
		c -= 0.05
	}
	
	var emptyFloats = new Float32Array( inputWidth * inputHeight * inputElementSize )
	var emptyFloatsExpanded = new Float32Array( inputWidth * inputHeight * inputElementSize * 4 )
	var emptyUInts = new Uint8Array( inputWidth * inputHeight * inputElementSize )
	inputs = {	dataA: inputA, dataAOut: emptyFloats,
				dataB: inputB, dataBOut: emptyFloats,
				dataC: inputC, dataCOut: emptyFloats,
				dataD: inputD, dataDOut: emptyFloats,
				dataROut: emptyUInts
	}
	return inputs
}

var TargetObjectA, TargetObjectB, TargetObjectR
var bufferA, bufferB, bufferR
function setupShaders( data ) {
/*
	Stage Setup Options
	
	Stages must be fed to gl-compute in the order of computations, a render stage (if any) provided lastly
	The computation cycle will pass the results of one stage to the next according to it's name (see bellow)
	The last computation stage will pass it's results back to the first stage accordingly
	(Logically, first stage data will be empty in the first pass, no data available from last stage)
	
	var outputBuffer = { data: new Float32Array( compute.width * compute.height * 4 ), callback: function(){ console.log(this.data) } }
	var options = {
		type			: Stage Type - 'COMPUTE' (for the actual computations) or
									   'RENDER' (can be ommited, optional for visualization purposes only)

		draw			: Draw Flag - to activate/deactivate this stage on demand
		
		stageShape		: Stage Shape - These are the dimensions of this stages' output
						  Length = stageShape[0] * stageShape[1] * 4 (4 = number of components/colors per element)

		shaderSources	: Shader Sources - to use in this stage
						  (these are barebones, create them and don't worry about uniform declaration - check uniforms option bellow)

		uniforms		: Stage Inputs - Data input to be fed to gl-compute
		
			{ uniformName : { type: 'sampler2D', object: object, location: string, shape: array, flip: boolean }
			
						  These will be made into texture uniforms and fragment shader source will be generated and added correspondingly
						  
						  Each named property here becomes the uniform name to be made available in the shader
						  Both the sampler2D uniform and a ivec2 containing the shape (dimensions) of the input is generated
						  						  
						  GLSL naming conventions apply
						  
						  The code generation includes a header and comments for your reference (ie. Stage Name and generation/compilation loop)
						  Use your browser's shader editor to check the complete GLSL code being compiled

		output			: Stage Output - definitions of the target object where data will be saved
		
			{ write: boolean, object: object, location: string, onUpdated: function }
			
						  Write Output Flag - This is where the most performance impact occurs, use sparingly when intermediate results are required
		
						  Object Reference / Porperty name where the data buffer lies / callback to a function when new data has been writen
	}
	
	Inititalise Stages - Provide options as an object, stages will be named here	
	compute.stagePreInit( { nameOfStage1: stageOptions1, nameOfStage2: stageOptions2, nameOfStage3: stageOptions3, renderStage: stageRender } )
	
*/

	var callback = function() { console.log( this.output.object[this.output.location] ) }
	var optionsA = {
		type			: 'COMPUTE',
		draw			: true,
		stageShape		: [compute.width, compute.height],
		shaderSources	: { vertex: shaderSources['vertStageA'], fragment: shaderSources['fragStageA'] },
		uniforms		: {						
				dataA		: { type: 'sampler2D', object: data, location: 'dataA', shape: [compute.width, compute.height, 4] },
				dataC		: { type: 'sampler2D', object: data, location: 'dataC', shape: [compute.width, compute.height, 1] },
				dataD		: { type: 'sampler2D', object: data, location: 'dataD', shape: [compute.width, compute.height, 1], flip: true }
		},
		output			: { write: true, object: data, location: 'dataAOut', onUpdated: callback }
	}
	
	var optionsB = {
		type			: 'COMPUTE',
		draw			: true,
		stageShape		: [compute.width, compute.height],
		shaderSources	: { vertex: shaderSources['vertStageB'], fragment: shaderSources['fragStageB'] },
		uniforms		: {
				dataB		: { type: 'sampler2D', object: data, location: 'dataB', shape: [compute.width, compute.height, 1] },
		},
		output			: { write: true, object: data, location: 'dataBOut', onUpdated: callback }
	}
	
	var optionsR = {
		type			: 'RENDER',
		stageShape		: [compute.width, compute.height],
		shaderSources	: { vertex: shaderSources['vertRender'], fragment: shaderSources['fragRender'] },
		uniforms		: {
				dataC		: { type: 'sampler2D', object: data, location: 'dataC', shape: [compute.width, compute.height, 1], flip: false },
				dataD		: { type: 'sampler2D', object: data, location: 'dataD', shape: [compute.width, compute.height, 1], flip: false }
		},
		output			: { write: false, object: data, location: 'dataROut', onUpdated: callback }
	}

	compute.stagePreInit( { StageA: optionsA, StageB: optionsB, Render: optionsR } )
}