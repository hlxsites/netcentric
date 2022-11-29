import { readBlockConfig } from '../../scripts/lib-franklin.js';

let jobOpenings;
let jobListOffset = 0;
let selectedPosition = 'all';
let selectedLocation = 'all';

function addCardsToCardList(cards, cardList) {
  cards.forEach((card) => {
    const jobListItem = document.createElement('li');
    jobListItem.classList.add('job-opening-list-item');

    jobListItem.innerHTML = `
    <a href="https://www.smartrecruiters.com/Netcentric/${
  card.id
}" target="_blank" rel="noopener noreferrer">
      <span class="position">${card.name}</span>
      <span class="location">${card.location.country.toUpperCase()} - ${
  card.location.city
}</span>
    </a>`;

    cardList.appendChild(jobListItem);
  });
}

function createJobFilters(parent, positions, locations, callback) {
  const filterContainer = document.createElement('div');
  filterContainer.classList.add('job-openings-filters');

  // positions filter
  const filterPositions = document.createElement('select');
  filterPositions.setAttribute('filter-type', 'positions');
  const defaultPositionTag = document.createElement('option');
  defaultPositionTag.innerText = 'all roles';
  defaultPositionTag.value = 'all';
  filterPositions.append(defaultPositionTag);

  positions.forEach((position) => {
    const optionTag = document.createElement('option');
    optionTag.innerText = position.trim();
    optionTag.value = position.trim();
    filterPositions.append(optionTag);
  });
  filterContainer.append(filterPositions);
  filterPositions.addEventListener('change', callback);

  // locations filter
  const filterLocations = document.createElement('select');
  filterLocations.setAttribute('filter-type', 'locations');
  const defaultLocationTag = document.createElement('option');
  defaultLocationTag.innerText = 'all countries';
  defaultLocationTag.value = 'all';
  filterLocations.append(defaultLocationTag);

  locations.forEach((location) => {
    const optionTag = document.createElement('option');
    optionTag.innerText = location.trim();
    optionTag.value = location.trim();
    filterLocations.append(optionTag);
  });
  filterContainer.append(filterLocations);
  filterLocations.addEventListener('change', callback);

  parent.appendChild(filterContainer);
}

function createJobList(parent, cards = []) {
  const results = document.createElement('p');
  results.classList.add('job-openings-results');

  const jobOpeningList = document.createElement('ul');
  jobOpeningList.classList.add('job-openings-list');

  addCardsToCardList(cards, jobOpeningList);

  parent.appendChild(results);
  parent.appendChild(jobOpeningList);
}

function createCTASection(parent, callback) {
  const buttonRow = document.createElement('div');
  buttonRow.classList.add('button-row');
  buttonRow.innerHTML = '<button id="load-more-button" class="button primary">Show More</button>';
  parent.append(buttonRow);
  parent.querySelector('#load-more-button').addEventListener('click', callback);
}

async function getJobOpenings(offset = 0) {
  const response = await fetch(
    `https://api.smartrecruiters.com/v1/companies/netcentric/postings?offset=${offset}&limit=100`,
  );
  const json = await response.json();
  return json;
}

async function updateJobOpenings(parent, num = 16) {
  // load first batch of job openings, if not already loaded
  if (!jobOpenings) {
    jobOpenings = await getJobOpenings(0);
  }

  // filter job openings
  const displayJobOpenings = jobOpenings.content.filter((jobItem) => {
    const matchLocation = selectedLocation === 'all'
      ? true
      : jobItem.customField
        .filter((e) => e.fieldLabel === 'Country')
        .map((e) => e.valueLabel)
        .indexOf(selectedLocation) > -1;
    const matchPosition = selectedPosition === 'all'
      ? true
      : jobItem.customField
        .filter((e) => e.fieldLabel === 'Role')
        .map((e) => e.valueLabel)
        .indexOf(selectedPosition) > -1;
    if (matchLocation && matchPosition) {
      return jobItem;
    }
    return null;
  });

  // update result count and list
  const results = parent.querySelector('.job-openings p.job-openings-results');
  const size = selectedLocation === 'all' && selectedPosition === 'all'
    ? jobOpenings.totalFound
    : displayJobOpenings.length;
  const count = jobListOffset + num < size ? jobListOffset + num : size;
  results.textContent = `Showing ${count} of ${size} jobs`;
  const jobList = parent.querySelector('.job-openings ul.job-openings-list');

  addCardsToCardList(displayJobOpenings.splice(jobListOffset, num), jobList);

  // load more items in the background
  while (jobOpenings.content.length < jobOpenings.totalFound) {
    const moreJobOpenings = await getJobOpenings(jobOpenings.content.length);
    jobOpenings.content.push(...moreJobOpenings.content);
  }

  // adjust offset for next loading
  jobListOffset += num;
}

function updateFilter(event) {
  const filterType = event.target.getAttribute('filter-type');
  if (filterType) {
    // update filters
    if (filterType === 'positions') {
      selectedPosition = event.target.value;
    }
    if (filterType === 'locations') {
      selectedLocation = event.target.value;
    }

    // reset all loaded job openings
    jobListOffset = 0;
    document.querySelector('.job-openings ul.job-openings-list').innerHTML = '';
    updateJobOpenings();
  }
}

export default async function decorate(block) {
  const { positions, locations } = readBlockConfig(block);
  block.innerHTML = '';

  createJobFilters(block, positions.split(','), locations.split(','), (e) => {
    updateFilter(e);
  });

  createJobList(block);
  updateJobOpenings(block);

  createCTASection(block, () => {
    updateJobOpenings(block);
  });
}