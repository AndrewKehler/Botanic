{
    /*
    General code structure derived from a video by Before Semicolon:
    Custom Audio Player with Web Component and Web Audio API: https://www.youtube.com/watch?v=rkqqBA6ohc0&t=93s

    Plenty of the code has been modified to suit the needs of the project.
    */

    //describes the class as an HTML element.
    class AudioPlayer extends HTMLElement{
        //initial variables
        playing = false;
        currentTime = 0;
        duration = 0;
        volume = 1;
        muted = false;
        initialized = false; 
        title = 'untitled';
        
        constructor(){
            /*
            Constructs an HTML element, then attaches all hidden shadow elements through the attachShadow method and render method.
            Then calls the audioCTX api and initializes the audio so volume can be controlled, and audio files can be heard.
            Finally attaches various style and audio based events allowing for dynamic audio control, and dynamic styling.
            */
            super();
            this.attachShadow({mode:'open'});
            this.render();
            this.initializeAudio();
            this.attachEvents();
        }

        //attributes of the element that are observed on creation in the index html file.
        static get observedAttributes(){
            return ['src','title','muted','crossorigin','loop','preload', 'points'];
        }

        //describes what happens when an observed attribute has been changed.
       async attributeChangedCallback(name, oldValue, newValue){
           //when the source is changed, check if playing and pause if it is. Then re-render the audio player.
            if (name === 'src'){
                if(this.playing){
                    await this.togglePlay();
                }
                this.initialized = false;
                this.render();
            //if the title is changed, update the title attribute, and title shadow element if exists.
            } else if(name === 'title'){
                this.title = newValue;

                if (this.titleElement){
                    this.titleElement.textContent = this.title;
                }
            }

           //creates an array constant of the attributes and updates any of the remaining observed attributes if they have been changed.
            for (let i = 0; i < this.attributes.length; i++){
                const attr = this.attributes[i];

                if( attr.specified && attr.name !== 'title'){
                    this.audio.setAttribute(attr.name, attr.value);
                }
            }
            //of the audio hasnt been initialized yet, do so.
            if (!this.initialized){
                this.initializeAudio();
            }
            console.log('---', name, oldValue, newValue);
        }
        
        //initializes the audio by calling the audioCtx API.
        initializeAudio(){
            if (this.initialized) return;
            console.log('-- initializeAudio');

            this.initialized = true;
            //connects the element to the audioCtx API
            this.audioCtx = new AudioContext();

            //describes the audio track, and allows for gain and data to be analyzed
            this.track = this.audioCtx.createMediaElementSource(this.audio);
            this.gainNode = this.audioCtx.createGain();
            this.analyzerNode = this.audioCtx.createAnalyser();

            //determines our frequency domain accuracy
            this.analyzerNode.fftSize = 2048;
            this.bufferLength = this.analyzerNode.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            this.analyzerNode.getByteFrequencyData(this.dataArray);

            //connects the track to the audioCtx elements.
            this.track
                .connect(this.gainNode)
                .connect(this.analyzerNode)
                .connect(this.audioCtx.destination);

                this.attachEvents();
        }

        //styles the frequency visualizer when an audio file is playing.
        updateFrequency(){
            if(!this.playing) return;
            
            this.analyzerNode.getByteFrequencyData(this.dataArray);

            //describes a canvas for the frewuency visualizer to be displayed.
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0)';
            this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            //constants for the canvas customizations.
            const barWidth = 2;
            const gap = 1;
            const barCount = this.bufferLength / ((barWidth + gap) - gap);
            let x = 0;
            
            /*
            loops through each frequency values and scales the frequency to fit within 255 so
            an RGB value can be associate with the frequency strength.
            */
            for (let i = 0; i < barCount; i++){
                const perc = (this.dataArray[i] * 100) / 255;
                const h = (perc * this.canvas.height) / 100;

                let green = this.dataArray[i];
                if(green >150){
                    green = 150;
                }else if(green < 90){
                    green = 90;
                };
                let blue = this.dataArray[i];
                if(blue >150){
                    blue = 150;
                }else if(blue < 98){
                    blue = 98;
                };

                //uses the dynamic RGB values from the loop to style the colours of the frequency visualizer.
                this.canvasCtx.fillStyle = `rgba(0,${green}, ${blue},  1)`;
                this.canvasCtx.fillRect(x, this.canvas.height - h, barWidth, h);
                
                x += barWidth + gap;

            }

            
            console.log('-- updateFrequency');
            

            requestAnimationFrame(this.updateFrequency.bind(this));
        }
                
        //Describes which events to attach when the method is called.
        attachEvents(){

            //methods to style the sliders when moved
            this.onload = this.levelScript();
            this.onload = this.progressScript();

            //methods to animate the audio and play SVGs on click
            this.playPauseBtn.addEventListener('click', this.togglePlay.bind(this), false);
            this.audioBtn.addEventListener('click', this.clickMute.bind(this), false);

            //attaches the styling methods to the volume and slider bars respectively.
            this.volumeBar.addEventListener('input', this.audioIconAnimate.bind(this), false);
            this.volumeBar.addEventListener('input', this.changeVolume.bind(this), false);
            this.volumeBar.addEventListener('input', this.levelScript.bind(this), false);
            this.progressBar.addEventListener('input', () => {
                this.seekTo(this.progressBar.value);
            }, false);
 
            /*
            initializes and attaches metadata of the audio file so we can access and 
            update the duration of the piece, and the current timestamp.
            */
            this.audio.addEventListener('loadedmetadata', () => {
                this.duration = this.audio.duration;
                this.progressBar.max = this.duration;

                const secs = parseInt(`${this.duration % 60}`, 10);
                const mins = parseInt(`${(this.duration/60) % 60}`, 10);

                this.durationEl.textContent = `${mins}:${secs}`;

                console.log('duration', this.audio.duration);
                console.log('currentTime', this.audio.currentTime);
            })

            //updates the current time.
            this.audio.addEventListener('timeupdate', () => {
                this.updateAudioTime(this.audio.currentTime);
            })
            this.audio.addEventListener('timeupdate', this.progressScript.bind(this), false);

            //describes what should happen after an audio file compeletes.
            this.audio.addEventListener('ended', () => {
                this.playing = false;
                this.canvasContain.style.maxHeight = "0"
                this.canvasContain.style.opacity = "0"
                this.pauseToPlay();
                // this.playPauseBtn.textContent = 'play';
            })
        }

        //Describes what happens when the state of the file switches from stopped and playing.
        async togglePlay(){
            if (this.audioCtx.state === 'suspended'){
                await this.audioCtx.resume();
            }
            //Pauses and closes the frequency visualizer canvas
            if (this.playing) {
                await this.audio.pause();
                this.playing = false;
                this.canvasContain.style.maxHeight = "0"
                this.canvasContain.style.opacity = "0"
                this.pauseToPlay();
            }else {
            //plays and opens frequency visualizer
                await this.audio.play();
                this.playing = true;
                this.updateFrequency();
                this.canvasContain.style.maxHeight = "200px"
                this.canvasContain.style.opacity = "100%"
                this.playToPause();
            }   
        }
        //describes an SVG animation from a play button to a pause button.
        playToPause(){
            const pausePath1 = `986.74,500 986.74,419.69 986.74,278.54 986.74,8.79 639.97,8.79 639.97,991.21 986.74,991.21 
            986.74,807.85 986.74,675.26 `;
            const pausePath2 = `343.77,500 343.77,8.79 260.9,8.79 96.23,8.79 16.03,8.79 16.03,991.21 101.31,991.21 240.58,991.21 
            343.77,991.21 `;        
            
            const timeline = anime.timeline({
                duration: 300,
                easing: 'easeOutQuad'
            });
            timeline
                .add({
                    targets: this.poly1,
                    points: [{value: pausePath1}]
                })
                .add({
                    targets: this.poly2,
                    points:[{value: pausePath2}]
                }, "-= 300");
        }
        //describes an SVG animation from a pause button to a play button.
        pauseToPlay(){
            const playPath1 = `985.89,500 879.85,437.16 770.78,379.41 631.06,313.83 492.94,241.03 492.94,754.94 630.21,687.82 
            770.68,614.88 879.64,555.89 `;  
            const playPath2 = `507.23,498.47 507.23,368.8 507.23,291.88 507.23,247.92 11.97,8.79 11.97,991.21 507.23,747.92 
            507.23,688.58 507.23,595.18`;

            const timeline = anime.timeline({
                duration: 300,
                easing: 'easeOutQuad'
            });
            timeline
                .add({
                    targets: this.poly1,
                    points: [{value: playPath1}]
                })
                .add({
                    targets: this.poly2,
                    points:[{value: playPath2}]
                }, "-= 300");
        }
        
        //lets us seek through the audio duration.
        seekTo(value) {
            this.audio.currentTime = value;
        }
        //updates the text that displays the current playback time.
        updateAudioTime(time){
            this.currentTime = time;
            this.progressBar.value = this.currentTime;

            const secs = `${parseInt(`${time % 60}`, 10)}`.padStart(2,'0');
            const mins = parseInt(`${(time/60) % 60}`, 10);

            this.currentTimeEl.textContent = `${mins}:${secs}`;
        }
        
        //lets us adjust the audio volume.
        changeVolume(){
            this.volume = this.volumeBar.value;
            this.gainNode.gain.value = this.volume;
            console.log(this.volume)
        }

        //describes the SVG animation of the audio icon at each stage of audio level. Mute, low, medium, and high volume.
        audioIconAnimate(){
            const audioHigh = [
                `M236.84,275.62c3.94,0,77.03-0.97,80.24-3.51l232.69-184.2c12.51-9.9,29.9,0,29.9,17.02v792.15 c0,15.71-15.06,25.82-27.65,18.55l-216.8-137.72c-2.7-1.56-26.9-0.85-29.94-0.85`,//body [0]

                `M311.62,777.06H46.82c-12.76,0-23.1-9.37-23.1-20.92v-459.2c0-11.56,10.34-20.92,23.1-20.92l196.38-0.4`, //body2 [1]

                `M267.68,519.71L267.68,519.71c-10.91,2.69-21.44-2.4-23.51-11.39l-1.91-16.68c-2.07-8.98,5.09-18.45,16-21.14
                l0,0c10.91-2.69,21.44,2.4,23.51,11.39l1.91,16.68C285.75,507.55,278.59,517.02,267.68,519.71z`, //mute [2]

                `M624.25,640.94c-13.53,0-26.32-8.13-31.61-21.47c-6.92-17.45,1.61-37.22,19.07-44.14 c31.4-12.46,51.69-42.34,51.69-76.12c0-32.04-20.09-61.46-51.19-74.94c-17.23-7.47-25.14-27.49-17.67-44.72 c7.47-17.23,27.49-25.14,44.72-17.67c55.97,24.27,92.14,78.17,92.14,137.33c0,30.61-9.18,60.06-26.54,85.17 c-16.94,24.49-40.47,43.21-68.07,54.16C632.66,640.17,628.42,640.94,624.25,640.94z`, //lowbar [3]

                `M658.88,754.99c-14.31,0-27.62-9.1-32.31-23.44c-5.84-17.85,3.9-37.05,21.75-42.88 C729.66,662.07,784.3,586.65,784.3,501c0-79.4-47.23-150.77-120.33-181.8c-17.28-7.34-25.35-27.3-18.01-44.58 c7.34-17.28,27.3-25.35,44.58-18.01C788.81,298.33,852.3,394.26,852.3,501c0,57.08-17.85,111.48-51.63,157.31 c-33.08,44.89-78.46,77.73-131.22,94.99C665.95,754.45,662.38,754.99,658.88,754.99z`, //mid bar [4]

                `M769.97,813.58c-13.08,0-25.55-7.59-31.15-20.34c-7.55-17.19,0.27-37.25,17.46-44.8 c90.94-39.92,152.04-142.61,152.04-255.53c0-112.91-61.1-215.6-152.04-255.53c-17.19-7.55-25.01-27.61-17.46-44.8 c7.55-17.19,27.61-25.01,44.8-17.46c56.56,24.83,104.74,67.81,139.32,124.27c34.93,57.03,53.39,123.95,53.39,193.52 c0,69.57-18.46,136.49-53.39,193.52c-34.58,56.47-82.76,99.44-139.32,124.27C779.17,812.65,774.53,813.58,769.97,813.58z` //high bar [5]
            ];
            const audioMid = [
                `M236.84,275.62c3.94,0,77.03-0.97,80.24-3.51l232.69-184.2c12.51-9.9,29.9,0,29.9,17.02v792.15 c0,15.71-15.06,25.82-27.65,18.55l-216.8-137.72c-2.7-1.56-26.9-0.85-29.94-0.85`,//body [0]

                `M311.62,777.06H46.82c-12.76,0-23.1-9.37-23.1-20.92v-459.2c0-11.56,10.34-20.92,23.1-20.92l196.38-0.4`, //body2 [1]

                `M267.68,519.71L267.68,519.71c-10.91,2.69-21.44-2.4-23.51-11.39l-1.91-16.68c-2.07-8.98,5.09-18.45,16-21.14
                l0,0c10.91-2.69,21.44,2.4,23.51,11.39l1.91,16.68C285.75,507.55,278.59,517.02,267.68,519.71z`, //mute [2]

                `M624.25,640.94c-13.53,0-26.32-8.13-31.61-21.47c-6.92-17.45,1.61-37.22,19.07-44.14 c31.4-12.46,51.69-42.34,51.69-76.12c0-32.04-20.09-61.46-51.19-74.94c-17.23-7.47-25.14-27.49-17.67-44.72 c7.47-17.23,27.49-25.14,44.72-17.67c55.97,24.27,92.14,78.17,92.14,137.33c0,30.61-9.18,60.06-26.54,85.17 c-16.94,24.49-40.47,43.21-68.07,54.16C632.66,640.17,628.42,640.94,624.25,640.94z`, //lowbar [3]

                `M658.88,754.99c-14.31,0-27.62-9.1-32.31-23.44c-5.84-17.85,3.9-37.05,21.75-42.88 C729.66,662.07,784.3,586.65,784.3,501c0-79.4-47.23-150.77-120.33-181.8c-17.28-7.34-25.35-27.3-18.01-44.58 c7.34-17.28,27.3-25.35,44.58-18.01C788.81,298.33,852.3,394.26,852.3,501c0,57.08-17.85,111.48-51.63,157.31 c-33.08,44.89-78.46,77.73-131.22,94.99C665.95,754.45,662.38,754.99,658.88,754.99z`, //mid bar [4]

                `M658.9,754.99c-13.08,0-25.55-7.59-31.15-20.34c-7.55-17.19,0.27-37.25,17.46-44.8
                c90.94-39.92,138.04-87.31,139.08-194.24c0.72-73.79-30.15-136.82-121.09-176.74c-17.19-7.55-25.01-27.61-17.46-44.8
                c7.55-17.19,27.61-25.01,44.8-17.46c56.56,24.83,96.99,61.5,120.72,102.45c33.53,57.86,41.03,90.57,41.03,136.55
                c0,49.19-6.32,84.12-41.24,141.15c-34.58,56.47-81.94,90.52-138.51,115.35C668.11,754.07,663.47,754.99,658.9,754.99z` //high bar [5]
            ];
            const audioLow = [
                `M236.84,275.62c3.94,0,77.03-0.97,80.24-3.51l232.69-184.2c12.51-9.9,29.9,0,29.9,17.02v792.15 c0,15.71-15.06,25.82-27.65,18.55l-216.8-137.72c-2.7-1.56-26.9-0.85-29.94-0.85`,//body [0]

                `M311.62,777.06H46.82c-12.76,0-23.1-9.37-23.1-20.92v-459.2c0-11.56,10.34-20.92,23.1-20.92l196.38-0.4`, //body2 [1]

                `M267.68,519.71L267.68,519.71c-10.91,2.69-21.44-2.4-23.51-11.39l-1.91-16.68c-2.07-8.98,5.09-18.45,16-21.14
                l0,0c10.91-2.69,21.44,2.4,23.51,11.39l1.91,16.68C285.75,507.55,278.59,517.02,267.68,519.71z`, //mute [2]

                `M624.25,640.94c-13.53,0-26.32-8.13-31.61-21.47c-6.92-17.45,1.61-37.22,19.07-44.14 c31.4-12.46,51.69-42.34,51.69-76.12c0-32.04-20.09-61.46-51.19-74.94c-17.23-7.47-25.14-27.49-17.67-44.72 c7.47-17.23,27.49-25.14,44.72-17.67c55.97,24.27,92.14,78.17,92.14,137.33c0,30.61-9.18,60.06-26.54,85.17 c-16.94,24.49-40.47,43.21-68.07,54.16C632.66,640.17,628.42,640.94,624.25,640.94z`, //lowbar [3]

                `M624.25,620.94c-14.31,0-26.92-7.13-31.61-21.47c-5.84-17.85,28.11,48.85,44.14,39.07
                C660.5,624.05,661.19,544.8,663.3,501c1.19-24.63-27-69.27-51.11-76.74c-17.94-5.55-25.01-27.43-17.67-44.72
                c7.34-17.28,22.5-30.64,40.1-24.08C685.63,374.47,731.3,459.26,731.3,501c0,25.34-8.46,58.13-26.46,83.37
                c-22.76,31.91-42.77,23.91-68.07,34.16C633.35,619.92,627.75,620.94,624.25,620.94z`, //mid bar [4]

                `M625.6,640.94c-13.08,0-25.55-7.59-31.15-20.34c-7.55-17.19,0.27-37.25,17.46-44.8
                c90.94-39.92,50.42,30.33,51.47-76.6c0.72-73.79,39.47-35.14-51.47-75.06c-17.19-7.55-25.01-27.61-17.46-44.8
                c7.55-17.19,27.54-24.86,44.8-17.46c34.97,14.99,54.24,29.4,65.38,53.14c17.78,37.86,26.76,46.38,26.76,84.19
                c0,37.04-13.55,63.38-26.54,85.17c-17.65,29.6-29.13,36.34-65.59,53.69C634.86,640.15,630.16,640.94,625.6,640.94z` //high bar [5]
            ];
            const audioMute = [
                `M283.2,275.26c3.94,0,30.67-0.61,33.88-3.15l232.69-184.2c12.51-9.9,29.9,0,29.9,17.02v792.15
                c0,15.71-15.06,25.82-27.65,18.55l-216.8-137.72c-2.7-1.56-3.53-0.85-6.57-0.85`,//body [0]

                `M254.66,777.06H46.82c-12.76,0-23.1-9.37-23.1-20.92v-459.2c0-11.56,10.34-20.92,23.1-20.92l149.38-0.3`, //body2 [1]

                `M306.71,889.83L306.71,889.83c-10.91,2.69-21.44-2.4-23.51-11.39l-74.88-675.82
                c-2.07-8.98,4.81-18.69,15.72-21.39l0,0c10.91-2.69,21.71,2.65,23.79,11.63l74.88,675.82C324.79,877.67,317.62,887.14,306.71,889.83
                z`, //mute [2]

                `M624.25,640.94c-13.53,0-26.32-8.13-31.61-21.47c-6.92-17.45,1.61-37.22,19.07-44.14 c31.4-12.46,51.69-42.34,51.69-76.12c0-32.04-20.09-61.46-51.19-74.94c-17.23-7.47-25.14-27.49-17.67-44.72 c7.47-17.23,27.49-25.14,44.72-17.67c55.97,24.27,92.14,78.17,92.14,137.33c0,30.61-9.18,60.06-26.54,85.17 c-16.94,24.49-40.47,43.21-68.07,54.16C632.66,640.17,628.42,640.94,624.25,640.94z`, //lowbar [3]

                `M624.25,620.94c-14.31,0-26.92-7.13-31.61-21.47c-5.84-17.85,28.11,48.85,44.14,39.07
                C660.5,624.05,661.19,544.8,663.3,501c1.19-24.63-27-69.27-51.11-76.74c-17.94-5.55-25.01-27.43-17.67-44.72
                c7.34-17.28,22.5-30.64,40.1-24.08C685.63,374.47,731.3,459.26,731.3,501c0,25.34-8.46,58.13-26.46,83.37
                c-22.76,31.91-42.77,23.91-68.07,34.16C633.35,619.92,627.75,620.94,624.25,620.94z`, //mid bar [4]

                `M625.6,640.94c-13.08,0-25.55-7.59-31.15-20.34c-7.55-17.19,0.27-37.25,17.46-44.8
                c90.94-39.92,50.42,30.33,51.47-76.6c0.72-73.79,39.47-35.14-51.47-75.06c-17.19-7.55-25.01-27.61-17.46-44.8
                c7.55-17.19,27.54-24.86,44.8-17.46c34.97,14.99,54.24,29.4,65.38,53.14c17.78,37.86,26.76,46.38,26.76,84.19
                c0,37.04-13.55,63.38-26.54,85.17c-17.65,29.6-29.13,36.34-65.59,53.69C634.86,640.15,630.16,640.94,625.6,640.94z` //high bar [5]
            ];

            //the animation that uses the above paths only if the volume matches the SVG state.
            this.volume = this.volumeBar.value;

            const timeline = anime.timeline({
                duration: 250,
                easing: 'easeOutQuad'
            });
            if(this.volume >= 1.5){
                timeline
                    .add({
                        targets: this.body1,
                        d: [{value: audioHigh[0]}]
                    })
                    .add({
                        targets: this.body2,
                        d:[{value:audioHigh[1]}]
                    }, "-= 250")
                    .add({
                        targets: this.mute,
                        d:[{value:audioHigh[2]}]
                    }, "-= 250")
                    .add({
                        targets: this.low,
                        d:[{value:audioHigh[3]}]
                    }, "-= 250")
                    .add({
                        targets: this.medium,
                        d:[{value:audioHigh[4]}]
                    }, "-= 250")
                    .add({
                        targets: this.high,
                        d:[{value:audioHigh[5]}]
                    }, "-= 250");   
            }else if(this.volume >= .5){
                timeline
                    .add({
                        targets: this.body1,
                        d: [{value: audioMid[0]}]
                    })
                    .add({
                        targets: this.body2,
                        d:[{value:audioMid[1]}]
                    }, "-= 250")
                    .add({
                        targets: this.mute,
                        d:[{value:audioMid[2]}]
                    }, "-= 250")
                    .add({
                        targets: this.low,
                        d:[{value:audioMid[3]}]
                    }, "-= 250")
                    .add({
                        targets: this.medium,
                        d:[{value:audioMid[4]}]
                    }, "-= 250")
                    .add({
                        targets: this.high,
                        d:[{value:audioMid[5]}]
                    }, "-= 250");   
            }else if(this.volume >= .1){
                timeline
                    .add({
                        targets: this.body1,
                        d: [{value: audioLow[0]}]
                    })
                    .add({
                        targets: this.body2,
                        d:[{value:audioLow[1]}]
                    }, "-= 250")
                    .add({
                        targets: this.mute,
                        d:[{value:audioLow[2]}]
                    }, "-= 250")
                    .add({
                        targets: this.low,
                        d:[{value:audioLow[3]}]
                    }, "-= 250")
                    .add({
                        targets: this.medium,
                        d:[{value:audioLow[4]}]
                    }, "-= 250")
                    .add({
                        targets: this.high,
                        d:[{value:audioLow[5]}]
                    }, "-= 250");   
            }else{
                timeline
                    .add({
                        targets: this.body1,
                        d: [{value: audioMute[0]}]
                    })
                    .add({
                        targets: this.body2,
                        d:[{value:audioMute[1]}]
                    }, "-= 250")
                    .add({
                        targets: this.mute,
                        d:[{value:audioMute[2]}]
                    }, "-= 250")
                    .add({
                        targets: this.low,
                        d:[{value:audioMute[3]}]
                    }, "-= 250")
                    .add({
                        targets: this.medium,
                        d:[{value:audioMute[4]}]
                    }, "-= 250")
                    .add({
                        targets: this.high,
                        d:[{value:audioMute[5]}]
                    }, "-= 250");   
            }
        }

        //animates the audio SVG to mute when clicked.
        clickMute(){
            const audioMute = [
                `M283.2,275.26c3.94,0,30.67-0.61,33.88-3.15l232.69-184.2c12.51-9.9,29.9,0,29.9,17.02v792.15
                c0,15.71-15.06,25.82-27.65,18.55l-216.8-137.72c-2.7-1.56-3.53-0.85-6.57-0.85`,//body [0]

                `M254.66,777.06H46.82c-12.76,0-23.1-9.37-23.1-20.92v-459.2c0-11.56,10.34-20.92,23.1-20.92l149.38-0.3`, //body2 [1]

                `M306.71,889.83L306.71,889.83c-10.91,2.69-21.44-2.4-23.51-11.39l-74.88-675.82
                c-2.07-8.98,4.81-18.69,15.72-21.39l0,0c10.91-2.69,21.71,2.65,23.79,11.63l74.88,675.82C324.79,877.67,317.62,887.14,306.71,889.83
                z`, //mute [2]

                `M624.25,640.94c-13.53,0-26.32-8.13-31.61-21.47c-6.92-17.45,1.61-37.22,19.07-44.14 c31.4-12.46,51.69-42.34,51.69-76.12c0-32.04-20.09-61.46-51.19-74.94c-17.23-7.47-25.14-27.49-17.67-44.72 c7.47-17.23,27.49-25.14,44.72-17.67c55.97,24.27,92.14,78.17,92.14,137.33c0,30.61-9.18,60.06-26.54,85.17 c-16.94,24.49-40.47,43.21-68.07,54.16C632.66,640.17,628.42,640.94,624.25,640.94z`, //lowbar [3]

                `M624.25,620.94c-14.31,0-26.92-7.13-31.61-21.47c-5.84-17.85,28.11,48.85,44.14,39.07
                C660.5,624.05,661.19,544.8,663.3,501c1.19-24.63-27-69.27-51.11-76.74c-17.94-5.55-25.01-27.43-17.67-44.72
                c7.34-17.28,22.5-30.64,40.1-24.08C685.63,374.47,731.3,459.26,731.3,501c0,25.34-8.46,58.13-26.46,83.37
                c-22.76,31.91-42.77,23.91-68.07,34.16C633.35,619.92,627.75,620.94,624.25,620.94z`, //mid bar [4]

                `M625.6,640.94c-13.08,0-25.55-7.59-31.15-20.34c-7.55-17.19,0.27-37.25,17.46-44.8
                c90.94-39.92,50.42,30.33,51.47-76.6c0.72-73.79,39.47-35.14-51.47-75.06c-17.19-7.55-25.01-27.61-17.46-44.8
                c7.55-17.19,27.54-24.86,44.8-17.46c34.97,14.99,54.24,29.4,65.38,53.14c17.78,37.86,26.76,46.38,26.76,84.19
                c0,37.04-13.55,63.38-26.54,85.17c-17.65,29.6-29.13,36.34-65.59,53.69C634.86,640.15,630.16,640.94,625.6,640.94z` //high bar [5]
            ];
            if(this.muted == false){
                this.muted = true;
                this.volumeBar.value = 0;
                this.gainNode.gain.value = this.volumeBar.value;
                this.volumeBar.style.background = `linear-gradient(to right, #ffff, #ffff `;
                this.audioIconAnimate(this);
            } else{
                this.muted = false;
                this.volumeBar.value = 1;
                this.audioIconAnimate();
                this.gainNode.gain.value = this.volumeBar.value;
                const sliderValue = this.volumeBar.value;
                this.volumeBar.style.background = `linear-gradient(to right, #15353D ${sliderValue *50}%, #ffff ${sliderValue *50}%)`;
            }
        }
        
        //adds a coloured background to the back of the progress bar as it progresses.
        progressScript() {
            const sliderValue = this.progressBar.value;
            const sliderMax = this.progressBar.max;
            this.progressBar.style.background = `linear-gradient(to right, #15353D ${sliderValue/(sliderMax/100)}%, #ffff ${sliderValue/(sliderMax/100)}%)`;
        }
        //does the same but for the audio slider.
        levelScript() {
            const sliderValue = this.volumeBar.value;
            this.volumeBar.style.background = `linear-gradient(to right, #15353D ${sliderValue *50}%, #ffff ${sliderValue *50}%)`;
        }
        //returns a style sheet so each element is styled by the same css file.
        style(){
            return `
            <link rel="stylesheet" href="css/player.css">
            <script src="anime.min.js"></script>
            `
        }

        //gives the element its HTML markup and inline styling.
        render(){
            this.shadowRoot.innerHTML = `
            ${this.style()}
            <figure class="audio-player">
                <figcaption class="audio-name">${this.title}</figcaption>
                <div class="canvas-contain">
                    <canvas></canvas>
                    <span class"line" style="display: block; width: 96%; background-color: white; height: 3px; border-radius: 3px; box-shadow: 1px 1px 0px 0.5px teal;"></span>  
                </div>
                <div class="audio-contain">  
                    <div class="media">
                        <audio style="display: none"></audio>
                        <button class="play-btn" type="button">
                            <svg id="playSvg" viewBox="0 0 1000 1000">
                            <polygon class="play-pause4" points="985.89,500 879.85,437.16 770.78,379.41 631.06,313.83 492.94,241.03 492.94,754.94 630.21,687.82 
                            770.68,614.88 879.64,555.89 "/>
                            <polygon class="play-pause3" points="507.23,498.47 507.23,368.8 507.23,291.88 507.23,247.92 11.97,8.79 11.97,991.21 507.23,747.92 
                                507.23,688.58 507.23,595.18 "/>
                            </svg>
                        </button>
                        <div class="progress-indicator">
                            <span class="current-time">0:00</span>
                            <input type="range" max="100" value="0" class="progress-bar">
                            <span class="duration">0:00</span>
                        </div>
                    </div>
                    <div class="volume-bar">
                            <svg id="audioIcn" viewBox="0 0 1000 1000" >
                                <path class="body1" d="M236.84,275.62c3.94,0,77.03-0.97,80.24-3.51l232.69-184.2c12.51-9.9,29.9,0,29.9,17.02v792.15
                                    c0,15.71-15.06,25.82-27.65,18.55l-216.8-137.72c-2.7-1.56-26.9-0.85-29.94-0.85"/>
                                <path class="body2" d="M311.62,777.06H46.82c-12.76,0-23.1-9.37-23.1-20.92v-459.2c0-11.56,10.34-20.92,23.1-20.92l196.38-0.4"/>
                                <path class="mute" d="M267.68,519.71L267.68,519.71c-10.91,2.69-21.44-2.4-23.51-11.39l-1.91-16.68c-2.07-8.98,5.09-18.45,16-21.14
                                    l0,0c10.91-2.69,21.44,2.4,23.51,11.39l1.91,16.68C285.75,507.55,278.59,517.02,267.68,519.71z"/>
                                <path class="low" d="M624.25,640.94c-13.53,0-26.32-8.13-31.61-21.47c-6.92-17.45,1.61-37.22,19.07-44.14
                                    c31.4-12.46,51.69-42.34,51.69-76.12c0-32.04-20.09-61.46-51.19-74.94c-17.23-7.47-25.14-27.49-17.67-44.72
                                    c7.47-17.23,27.49-25.14,44.72-17.67c55.97,24.27,92.14,78.17,92.14,137.33c0,30.61-9.18,60.06-26.54,85.17
                                    c-16.94,24.49-40.47,43.21-68.07,54.16C632.66,640.17,628.42,640.94,624.25,640.94z"/>
                                <path class="medium" d="M658.88,754.99c-14.31,0-27.62-9.1-32.31-23.44c-5.84-17.85,3.9-37.05,21.75-42.88
                                    C729.66,662.07,784.3,586.65,784.3,501c0-79.4-47.23-150.77-120.33-181.8c-17.28-7.34-25.35-27.3-18.01-44.58
                                    c7.34-17.28,27.3-25.35,44.58-18.01C788.81,298.33,852.3,394.26,852.3,501c0,57.08-17.85,111.48-51.63,157.31
                                    c-33.08,44.89-78.46,77.73-131.22,94.99C665.95,754.45,662.38,754.99,658.88,754.99z"/>
                                <path class="high" d="M658.9,754.99c-13.08,0-25.55-7.59-31.15-20.34c-7.55-17.19,0.27-37.25,17.46-44.8
                                c90.94-39.92,138.04-87.31,139.08-194.24c0.72-73.79-30.15-136.82-121.09-176.74c-17.19-7.55-25.01-27.61-17.46-44.8
                                c7.55-17.19,27.61-25.01,44.8-17.46c56.56,24.83,96.99,61.5,120.72,102.45c33.53,57.86,41.03,90.57,41.03,136.55
                                c0,49.19-6.32,84.12-41.24,141.15c-34.58,56.47-81.94,90.52-138.51,115.35C668.11,754.07,663.47,754.99,658.9,754.99z"/>
                            </svg>
                    <input type="range" min="0" max="2" step="0.01" value="${this.volume}" class="volume-field">
                    </div>
                </div>
                <div class="shape"></div>               
            </figure>
            `;
            
            //all html class selection for styling.
            this.audioBtn = this.shadowRoot.querySelector('#audioIcn');
            this.body1 = this.audioBtn.children[0];
            this.body2 = this.audioBtn.children[1];
            this.mute = this.audioBtn.children[2];
            this.low = this.audioBtn.children[3];
            this.medium = this.audioBtn.children[4];
            this.high = this.audioBtn.children[5];

            this.playBtn = this.shadowRoot.querySelector('#playSvg');
            this.poly1 = this.playBtn.children[0];
            this.poly2 = this.playBtn.children[1];

            this.audio = this.shadowRoot.querySelector('audio');
            this.canvas = this.shadowRoot.querySelector('canvas');
            this.playPauseBtn = this.shadowRoot.querySelector('.play-btn');
            this.titleElement = this.shadowRoot.querySelector('.audio-name');
            this.volumeBar = this.shadowRoot.querySelector('.volume-field')
            this.progressIndicator = this.shadowRoot.querySelector('.progress-indicator');
            this.currentTimeEl = this.progressIndicator.children[0];
            this.progressBar = this.progressIndicator.children[1];
            this.durationEl = this.progressIndicator.children[2];
            this.canvasContain = this.shadowRoot.querySelector('.canvas-contain');

            this.canvasCtx = this.canvas.getContext('2d');
        }
    }

    customElements.define('audio-player', AudioPlayer)
}
