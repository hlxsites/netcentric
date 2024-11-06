export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.ariaLabel = `${window.placeholders?.default?.socialChannels || 'Social Channels'}`;
  [...block.children].forEach((div) => {
    let a = div.querySelector('a');
    const li = document.createElement('li');
    const icon = div.querySelector('.icon');
    const texts = div.querySelectorAll('h2,p');
    const title = div.querySelector('h2');
    const [, iconName] = icon.className.split('icon icon-');

    if (a) {
      a = a.cloneNode(false);
      a.target = '_blank';
      a.className = '';
      a.title = title ? title.innerText : '';
      li.appendChild(a);
    } else {
      a = li;
    }

    li.classList.add('social-card', iconName);

    texts.forEach((text) => a.appendChild(text));
    a.appendChild(icon);
    ul.appendChild(li);
  });

  block.textContent = '';
  block.appendChild(ul);
}
