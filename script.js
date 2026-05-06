// CURSOR
const cur=document.getElementById('cur'),curR=document.getElementById('cur-r');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;cur.style.left=mx+'px';cur.style.top=my+'px';});
(function loop(){rx+=(mx-rx)*.1;ry+=(my-ry)*.1;curR.style.left=rx+'px';curR.style.top=ry+'px';requestAnimationFrame(loop);})();
document.querySelectorAll('a,button,.proj-item,.svc,.skill-row').forEach(el=>{
  el.addEventListener('mouseenter',()=>document.body.classList.add('ch'));
  el.addEventListener('mouseleave',()=>document.body.classList.remove('ch'));
});

// INTERSECTION OBSERVER
const io=new IntersectionObserver(e=>{e.forEach(x=>{if(x.isIntersecting){x.target.classList.add('vis');io.unobserve(x.target);}});},{threshold:.12});
document.querySelectorAll('.fi').forEach(el=>io.observe(el));

const pio=new IntersectionObserver(e=>{e.forEach((x,i)=>{if(x.isIntersecting){setTimeout(()=>x.target.classList.add('vis'),i*80);pio.unobserve(x.target);}});},{threshold:.1});
document.querySelectorAll('.proj-item').forEach(el=>pio.observe(el));

// HAMBURGER
const hbg=document.getElementById('hbg'),mob=document.getElementById('mobMenu');
let open=false;
hbg.addEventListener('click',()=>{
  open=!open;mob.classList.toggle('open',open);
  const s=hbg.querySelectorAll('span');
  if(open){s[0].style.transform='rotate(45deg) translate(4px,4px)';s[1].style.opacity='0';s[2].style.transform='rotate(-45deg) translate(4px,-4px)';}
  else{s.forEach(x=>{x.style.transform='';x.style.opacity=''});}
});
function closeMob(){open=false;mob.classList.remove('open');hbg.querySelectorAll('span').forEach(x=>{x.style.transform='';x.style.opacity=''});}

// SMOOTH SCROLL
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{const t=document.querySelector(a.getAttribute('href'));if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}});
});

// NAV OPACITY
window.addEventListener('scroll',()=>{
  document.getElementById('nav').style.background=window.scrollY>40?'white':'transparent';
});


// !! IMPORTANT: GOOGLE FORM CONFIGURATION (The correct, functional logic) !!

const FORM_ID = "1FAIpQLSczV7to0hvM6wCbxzx_qfncLimfOWYEuap8438x4IngDO4f0w";
const GOOGLE_FORM_SUBMIT_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`; 

const FIELD_MAP = {
    'name': '780854094',      
    'email': '383541647',    
    'project': '714113470', 
    'message': '511356580'  
};

function showSuccessPopup() {
    const popup = document.getElementById('successPopup');
    if (!popup) {
        console.error("Popup element #successPopup not found.");
        return;
    }

    popup.classList.add('show');
    popup.style.display = 'block';

    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => {
            popup.style.display = 'none';
        }, 500); 
    }, 3000); 
}

// --- Event Listener for Form Submission (This is the one that works) ---
document.getElementById('contactForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const dataToSubmit = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
        const googleId = FIELD_MAP[key];
        
        if (googleId) {
            dataToSubmit.append(`entry.${googleId}`, value);
        }
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;

    try {
        await fetch(GOOGLE_FORM_SUBMIT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: dataToSubmit 
        });

        showSuccessPopup(); 
        form.reset();

    } catch (error) {
        console.error('Submission error:', error);
        alert('There was an error sending your message. Please try again.');
    } finally {
        submitButton.textContent = 'Send Message 🚀';
        submitButton.disabled = false;
    }
});
