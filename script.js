document.addEventListener('DOMContentLoaded', () => {
    // === Existing experiment navigation code (unchanged) ===
    const nextBtn = document.getElementById('next-btn');
    const images = document.querySelectorAll('.step-image');
    const texts = document.querySelectorAll('.step-text');
    let currentStep = 0;

    function handleButtonClick() {
        if (currentStep < images.length - 1) {
            texts[currentStep].classList.remove('visible');
            currentStep++;
            images[currentStep].classList.add('visible');
            texts[currentStep].classList.add('visible');

            if (currentStep === images.length - 1) {
                nextBtn.textContent = 'Next page';
            }
        } else {
            window.location.href = 'instruction2.html';
        }
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', handleButtonClick);
    }

    // === Original redirectButton code (unchanged) ===
    document.querySelectorAll('.redirectButton').forEach(btn => {
        btn.addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            window.location.href = url;
        });
    });

    // === MTurk button logic for final page only ===
    const mturkButton = document.getElementById('mturk-submit-btn');
    if (mturkButton) {
        mturkButton.addEventListener('click', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const assignmentId = urlParams.get('assignmentId');

            if (assignmentId && assignmentId !== "ASSIGNMENT_ID_NOT_AVAILABLE") {
                // Redirect MTurk worker to submission page
                window.location.href = `https://www.mturk.com/mturk/externalSubmit?assignmentId=${assignmentId}`;
            } else {
                // Not from MTurk -> alert and attempt to exit
                alert("This page is only accessible through Mechanical Turk. Exiting.");
                try {
                    window.close();
                } catch (e) {
                    // Some browsers block window.close()
                    console.warn("Cannot close window automatically.");
                }
            }
        });
    }
});


