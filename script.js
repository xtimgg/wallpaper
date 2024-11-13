document.addEventListener("DOMContentLoaded", function() {
    const canvas = document.getElementById('dotCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const dots = [];
    let DOT_COUNT = 100;
    let MAX_DISTANCE = 150;
    let MOUSE_RADIUS = 100;
    let GRAVITY_STRENGTH = 0.02;
    let PUSH_STRENGTH = 0.05;
    let DEFAULT_SPEED = 1;
    let SLOW_DOWN_FACTOR = 0.99;
    let SLOW_DOWN_FACTOR_2 = 0.90;
    let RECTANGLE_GRAVITY = 10;
    let COLOR_TRANSITION_LENGTH = 500;
    const SHOW_RECTANGLE_OUTLINE = false;
    let BOTTOM_INACTIVE_HEIGHT = 40;
    let SHAKE_INTENSITY = 0;
    let EDGE_MARGIN = 300; // Additional margin for edges
    let hue = 320;
    let COLOR = `hsl(${hue}, 100%, 50%)`;
    let PER_DOT_CONNECTIONS_LIMIT = 50;
    let GLOBAL_CONNECTIONS_LIMIT = 5000;
    let DRAG_THRESHOLD = 9999999;
    let PARALLAX_STRENGTH = 0.35;
    let SMOOTHING_FACTOR = 0.02;

    // Variables for dynamic updates
    const sliders = {
        dotCount: 140,
        maxDistance: 195,
        mouseRadius: 200,
        gravityStrength: 0.02,
        pushStrength: 0.05,
        defaultSpeed: 2,
        slowDownFactor: 0.99,
        slowDownFactor2: 0.90,
        rectangleGravity: 10,
        colorTransitionLength: 500,
        bottomInactiveHeight: 40,
        shakeIntensity: 0,
        edgeMargin: 300,
        hue: 256,
        perDotConnectionsLimit: 50,
        globalConnectionsLimit: 220,
        dragThreshold: 9999999,
        parallaxStrength: 0.35,
        smoothingFactor: 0.02
    };

    // Function to update the variables from the sliders
    function updateVariables() {
        DOT_COUNT = sliders.dotCount;
        MAX_DISTANCE = sliders.maxDistance;
        MOUSE_RADIUS = sliders.mouseRadius;
        GRAVITY_STRENGTH = sliders.gravityStrength;
        PUSH_STRENGTH = sliders.pushStrength;
        DEFAULT_SPEED = sliders.defaultSpeed;
        SLOW_DOWN_FACTOR = sliders.slowDownFactor;
        SLOW_DOWN_FACTOR_2 = sliders.slowDownFactor2;
        RECTANGLE_GRAVITY = sliders.rectangleGravity;
        COLOR_TRANSITION_LENGTH = sliders.colorTransitionLength;
        BOTTOM_INACTIVE_HEIGHT = sliders.bottomInactiveHeight;
        SHAKE_INTENSITY = sliders.shakeIntensity;
        EDGE_MARGIN = sliders.edgeMargin;
        hue = sliders.hue;
        COLOR = `hsl(${hue}, 100%, 50%)`;
        PER_DOT_CONNECTIONS_LIMIT = sliders.perDotConnectionsLimit;
        GLOBAL_CONNECTIONS_LIMIT = sliders.globalConnectionsLimit;
        DRAG_THRESHOLD = sliders.dragThreshold;
        PARALLAX_STRENGTH = sliders.parallaxStrength;
        SMOOTHING_FACTOR = sliders.smoothingFactor;
    }

    // Call this function whenever the sliders are updated
    function onSliderChange() {
        updateVariables();
        // Redraw or reinitialize the dots if necessary
    }

    // Initialize the sliders
    function initializeSliders() {
        for (const key in sliders) {
            const slider = document.getElementById(key);
            if (slider) {
                slider.value = sliders[key];
                slider.addEventListener('input', (event) => {
                    sliders[key] = parseFloat(event.target.value);
                    onSliderChange();
                });
            }
        }
    }

    initializeSliders();
    updateVariables();

    let globalConnections = 0;
    let mouse = {
        x: undefined,
        y: undefined,
        isMoving: false,
        moveTimeout: null,
        parallaxOffsetX: 0,
        parallaxOffsetY: 0,
        targetParallaxOffsetX: 0,
        targetParallaxOffsetY: 0
    };

    let isDragging = false;
    let isMouseDown = false;
    let dragStart = { x: 0, y: 0 };
    let dragEnd = { x: 0, y: 0 };
    let hasDragged = false;
    let rectanglePoints = [];

    let dotPulse = 0;
    let pulseDirection = 1;
    let shakeOffset = { x: 0, y: 0 };
    let shakeElapsed = 0;

    let smoothParallaxOffsetX = 0;
    let smoothParallaxOffsetY = 0;

    canvas.addEventListener('mousemove', function(event) {
        mouse.x = event.x;
        mouse.y = event.y;
        mouse.isMoving = true;
        clearTimeout(mouse.moveTimeout);
        mouse.moveTimeout = setTimeout(() => {
            mouse.isMoving = false;
        }, 100);

        mouse.targetParallaxOffsetX = (event.x - canvas.width / 2) * PARALLAX_STRENGTH;
        mouse.targetParallaxOffsetY = (event.y - canvas.height / 2) * PARALLAX_STRENGTH;

        if (isDragging) {
            dragEnd.x = event.x;
            dragEnd.y = event.y;
            if (Math.abs(dragEnd.x - dragStart.x) > DRAG_THRESHOLD || Math.abs(dragEnd.y - dragStart.y) > DRAG_THRESHOLD) {
                hasDragged = true;
                updateRectanglePoints();
            }
        }
    });

    canvas.addEventListener('mousedown', function(event) {
        if (event.clientY > canvas.height - BOTTOM_INACTIVE_HEIGHT) return;

        isMouseDown = true;
        isDragging = true;
        hasDragged = false;
        dragStart.x = event.x;
        dragStart.y = event.y;
        dragEnd.x = event.x;
        dragEnd.y = event.y;
    });

    canvas.addEventListener('mouseup', function(event) {
        if (event.clientY > canvas.height - BOTTOM_INACTIVE_HEIGHT) return;

        isMouseDown = false;
        isDragging = false;
        if (!hasDragged) {
            scatterDots();
            changeDotColors();
            shakeCanvas();
        } else {
            scatterDots();
        }
    });

    window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initializeDots();
    });

    window.addEventListener('blur', function() {
        cancelDragging();
    });

    window.addEventListener('focus', function() {});

    function cancelDragging() {
        isMouseDown = false;
        isDragging = false;
        hasDragged = false;
        rectanglePoints = [];
    }

    function initializeDots() {
        dots.length = 0;
        for (let i = 0; i < DOT_COUNT; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const angle = Math.random() * 2 * Math.PI;
            const dx = Math.cos(angle) * DEFAULT_SPEED;
            const dy = Math.sin(angle) * DEFAULT_SPEED;
            const depth = 0.5 + Math.random() * 0.5; // Random depth between 0.5 and 1
            dots.push({ x, y, dx, dy, depth, connections: 0 });
        }
    }

    function drawDots() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR;

        dots.forEach(dot => {
            const parallaxX = dot.depth * mouse.parallaxOffsetX;
            const parallaxY = dot.depth * mouse.parallaxOffsetY;
            const size = 3 + (1 - dot.depth) * 5 + dotPulse; // Size changes with depth and pulse
            const opacity = 0.3 + (1 - dot.depth) * 0.7; // Opacity changes with depth
            ctx.beginPath();
            ctx.arc(dot.x + parallaxX + shakeOffset.x, dot.y + parallaxY + shakeOffset.y, size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${opacity})`;
            ctx.fill();
        });

        connectDots();
        connectMouseToDots();
        if (isDragging && hasDragged) {
            drawRectangle();
        }
    }

    function connectDots() {
        ctx.shadowBlur = 5;
        ctx.shadowColor = COLOR;
        ctx.lineWidth = 1.5;

        globalConnections = 0;
        dots.forEach(dot => dot.connections = 0);

        for (let i = 0; i < dots.length; i++) {
            const parallaxXI = dots[i].depth * mouse.parallaxOffsetX;
            const parallaxYI = dots[i].depth * mouse.parallaxOffsetY;

            for (let j = i + 1; j < dots.length; j++) {
                if (globalConnections >= GLOBAL_CONNECTIONS_LIMIT) break;
                const dist = distance(dots[i], dots[j]);
                if (dist < MAX_DISTANCE && dots[i].connections < PER_DOT_CONNECTIONS_LIMIT && dots[j].connections < PER_DOT_CONNECTIONS_LIMIT) {
                    const parallaxXJ = dots[j].depth * mouse.parallaxOffsetX;
                    const parallaxYJ = dots[j].depth * mouse.parallaxOffsetY;

                    dots[i].connections++;
                    dots[j].connections++;
                    globalConnections++;
                    ctx.beginPath();
                    ctx.moveTo(dots[i].x + parallaxXI + shakeOffset.x, dots[i].y + parallaxYI + shakeOffset.y);
                    ctx.lineTo(dots[j].x + parallaxXJ + shakeOffset.x, dots[j].y + parallaxYJ + shakeOffset.y);
                    ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${0.8 * (1 - dist / MAX_DISTANCE)})`;
                    ctx.stroke();
                }
            }
        }
    }

    function connectMouseToDots() {
        ctx.shadowBlur = 5;
        ctx.shadowColor = COLOR;
        ctx.lineWidth = 2;

        dots.forEach(dot => {
            const parallaxX = dot.depth * mouse.parallaxOffsetX;
            const parallaxY = dot.depth * mouse.parallaxOffsetY;
            const dist = distance(mouse, dot);
            if (dist < MOUSE_RADIUS) {
                ctx.beginPath();
                ctx.moveTo(mouse.x, mouse.y);
                ctx.lineTo(dot.x + parallaxX + shakeOffset.x, dot.y + parallaxY + shakeOffset.y);
                ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${1 * (1 - dist / MOUSE_RADIUS)})`;
                ctx.stroke();
            }
        });
    }

    function distance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function animate() {
        let nearbyDots = 0;

        // Smoothly update the parallax offsets
        smoothParallaxOffsetX += (mouse.targetParallaxOffsetX - smoothParallaxOffsetX) * SMOOTHING_FACTOR;
        smoothParallaxOffsetY += (mouse.targetParallaxOffsetY - smoothParallaxOffsetY) * SMOOTHING_FACTOR;
        mouse.parallaxOffsetX = smoothParallaxOffsetX;
        mouse.parallaxOffsetY = smoothParallaxOffsetY;

        dots.forEach((dot, index) => {
            const dist = distance(mouse, dot);
            if (dist < MOUSE_RADIUS) {
                nearbyDots++;
                if (mouse.isMoving) {
                    const angle = Math.atan2(mouse.y - dot.y, mouse.x - dot.x);
                    dot.dx += Math.cos(angle) * GRAVITY_STRENGTH;
                    dot.dy += Math.sin(angle) * GRAVITY_STRENGTH;
                }
                if (nearbyDots > 10) {
                    const angle = Math.atan2(dot.y - mouse.y, dot.x - mouse.x);
                    dot.dx += Math.cos(angle) * PUSH_STRENGTH;
                    dot.dy += Math.sin(angle) * PUSH_STRENGTH;
                }
            }

            if (hasDragged && rectanglePoints.length > 0) {
                const target = rectanglePoints[index];
                const parallaxX = dot.depth * mouse.parallaxOffsetX;
                const parallaxY = dot.depth * mouse.parallaxOffsetY;
                const adjustedTarget = {
                    x: target.x - parallaxX,
                    y: target.y - parallaxY
                };
                const angle = Math.atan2(adjustedTarget.y - dot.y, adjustedTarget.x - dot.x);
                const distanceToTarget = distance(dot, adjustedTarget);
                dot.dx += Math.cos(angle) * RECTANGLE_GRAVITY * Math.min(1, distanceToTarget / 50);
                dot.dy += Math.sin(angle) * RECTANGLE_GRAVITY * Math.min(1, distanceToTarget / 50);

                if (distanceToTarget < 1) {
                    dot.dx *= SLOW_DOWN_FACTOR_2;
                    dot.dy *= SLOW_DOWN_FACTOR_2;
                }
            }

            const speed = Math.sqrt(dot.dx * dot.dx + dot.dy * dot.dy);
            if (speed > DEFAULT_SPEED) {
                dot.dx *= hasDragged ? SLOW_DOWN_FACTOR_2 : SLOW_DOWN_FACTOR;
                dot.dy *= hasDragged ? SLOW_DOWN_FACTOR_2 : SLOW_DOWN_FACTOR;
            }

            dot.x += dot.dx;
            dot.y += dot.dy;

            if (dot.x < -EDGE_MARGIN || dot.x > canvas.width + EDGE_MARGIN) dot.dx = -dot.dx;
            if (dot.y < -EDGE_MARGIN || dot.y > canvas.height + EDGE_MARGIN / 2) dot.dy = -dot.dy;
        });

        drawDots();
        updatePulse();
        updateColorTransition();
        updateShake();
        requestAnimationFrame(animate);
    }

    function scatterDots() {
        dots.forEach(dot => {
            const angle = Math.random() * 2 * Math.PI;
            const speed = DEFAULT_SPEED * 5;
            dot.dx = Math.cos(angle) * speed;
            dot.dy = Math.sin(angle) * speed;
        });
        rectanglePoints = [];
        hasDragged = false;
    }

    function changeDotColors() {
        hue = (hue + 0) % 360;
    }

    function shakeCanvas() {
        shakeElapsed = 0;
    }

    function drawRectangle() {
        if (SHOW_RECTANGLE_OUTLINE) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(dragStart.x, dragStart.y, dragEnd.x - dragStart.x, dragEnd.y - dragStart.y);
        }
    }

    function updateRectanglePoints() {
        const xMin = Math.min(dragStart.x, dragEnd.x);
        const xMax = Math.max(dragStart.x, dragEnd.x);
        const yMin = Math.min(dragStart.y, dragEnd.y);
        const yMax = Math.max(dragStart.y, dragEnd.y);
        const perimeter = 2 * (xMax - xMin) + 2 * (yMax - yMin);
        const segmentLength = perimeter / DOT_COUNT;

        rectanglePoints = [];
        let currentLength = 0;

        for (let i = 0; i < DOT_COUNT; i++) {
            let edgePos;
            if (currentLength < xMax - xMin) {
                edgePos = { x: xMin + currentLength, y: yMin };
            } else if (currentLength < (xMax - xMin) + (yMax - yMin)) {
                edgePos = { x: xMax, y: yMin + (currentLength - (xMax - xMin)) };
            } else if (currentLength < 2 * (xMax - xMin) + (yMax - yMin)) {
                edgePos = { x: xMax - (currentLength - (xMax - xMin) - (yMax - yMin)), y: yMax };
            } else {
                edgePos = { x: xMin, y: yMax - (currentLength - 2 * (xMax - xMin) - (yMax - yMin)) };
            }
            rectanglePoints.push(edgePos);
            currentLength += segmentLength;
        }
    }

    function updatePulse() {
        dotPulse += pulseDirection * 0.05;
        if (dotPulse > 3 || dotPulse < 0) {
            pulseDirection *= -1;
        }
    }

    function updateColorTransition() {
        COLOR = `hsl(${hue}, 100%, 50%)`;
    }

    function updateShake() {
        const shakeDuration = 2000;
        const shakeInterval = 100;

        if (shakeElapsed < shakeDuration) {
            shakeOffset.x = (Math.random() - 0.5) * SHAKE_INTENSITY;
            shakeOffset.y = (Math.random() - 0.5) * SHAKE_INTENSITY;
            shakeElapsed += shakeInterval;
        } else {
            shakeOffset = { x: 0, y: 0 };
        }
    }

    setInterval(changeDotColors, COLOR_TRANSITION_LENGTH);

    initializeDots();
    animate();
});


document.addEventListener('DOMContentLoaded', () => {
    const sliders = {
        dotCount: 140,
        maxDistance: 195,
        mouseRadius: 200,
        gravityStrength: 0.02,
        pushStrength: 0.05,
        defaultSpeed: 2,
        slowDownFactor: 0.99,
        slowDownFactor2: 0.90,
        rectangleGravity: 10,
        colorTransitionLength: 500,
        bottomInactiveHeight: 40,
        shakeIntensity: 0,
        edgeMargin: 300,
        hue: 260,
        perDotConnectionsLimit: 3,
        globalConnectionsLimit: 220,
        dragThreshold: 30,
        parallaxStrength: 0.35,
        smoothingFactor: 0.02
    };

    function updateSliderValues() {
        for (const key in sliders) {
            const slider = document.getElementById(key);
            const valueDisplay = document.getElementById(`${key}Value`);
            if (slider && valueDisplay) {
                slider.value = sliders[key];
                valueDisplay.textContent = sliders[key];

                slider.addEventListener('input', (event) => {
                    sliders[key] = parseFloat(event.target.value);
                    valueDisplay.textContent = sliders[key];
                    if (key === 'hue') {
                        document.querySelectorAll('.settingsButton').forEach(btn => {
                            btn.style.color = `hsl(${sliders.hue}, 100%, 50%)`;
                            btn.style.borderColor = `hsl(${sliders.hue}, 100%, 50%)`;
                        });
                    }
                    console.log(`${key}: ${sliders[key]}`);
                });
            }
        }
    }

    const buttons = document.querySelectorAll('.settingsButton');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            buttons.forEach(btn => {
                btn.classList.add('settingsButtonHover');
                if (btn.classList.contains('blur')) {
                    btn.classList.add('blurHover');
                }
            });
        });

        button.addEventListener('mouseleave', () => {
            buttons.forEach(btn => {
                btn.classList.remove('settingsButtonHover');
                if (btn.classList.contains('blur')) {
                    btn.classList.remove('blurHover');
                }
            });
        });
    });

    updateSliderValues();
});

document.addEventListener('DOMContentLoaded', function() {
    var settingsButton = document.getElementById('settingsButton');
    var settingsMenuCollider = document.getElementById('settingsMenuCollider');
    var hoverTimeout;

    function toggleClass() {
        settingsMenuCollider.classList.toggle('changed');
    }

    function startHoverTimeout() {
        hoverTimeout = setTimeout(function() {
            settingsMenuCollider.classList.remove('changed');
        }, 3000);
    }

    function clearHoverTimeout() {
        clearTimeout(hoverTimeout);
    }

    settingsButton.addEventListener('click', function() {
        toggleClass();
    });

    settingsMenuCollider.addEventListener('mouseenter', clearHoverTimeout);
    settingsMenuCollider.addEventListener('mouseleave', startHoverTimeout);
});
