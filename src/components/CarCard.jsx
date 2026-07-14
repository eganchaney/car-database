import { Link } from 'react-router-dom'
import { coverUrl, initials, isOneOff } from '../lib/data.js'
import { familyAccent } from '../lib/theme.js'
import { toggleFavorite, useFavorites } from '../lib/favorites.js'

export function Tags({ car }) {
  return (
    <div className="tags">
      {car.market.road_legal === false && <span className="tag track">Track only</span>}
      {isOneOff(car) && <span className="tag oneoff">One-off</span>}
    </div>
  )
}

export function FavHeart({ id, inline = false }) {
  const favs = useFavorites()
  const on = favs.includes(id)
  return (
    <button
      className={`fav${on ? ' on' : ''}${inline ? ' inline' : ''}`}
      aria-label={on ? 'Remove from favorites' : 'Add to favorites'}
      title={on ? 'Remove from favorites' : 'Add to favorites'}
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(id) }}
    >{on ? '♥' : '♡'}</button>
  )
}

export default function CarCard({ car, brand, showBrand = false }) {
  const cover = coverUrl(car)
  const fam = familyAccent(brand, car.family)
  return (
    <Link className="card" to={`/${car.id}`} style={fam ? { '--fam': fam } : undefined}>
      <div className="cover">
        <span className="fam-spine" />
        {cover
          ? <img src={cover} alt={car.model} loading="lazy" />
          : <div className="mono-mark">{initials(car)}</div>}
      </div>
      <FavHeart id={car.id} />
      <div className="cbody">
        {showBrand && <div className="cbrand">{brand.name}</div>}
        <div className="crow">
          <span className="cname">{car.model}</span>
          <span className="cyear">{car.year}</span>
        </div>
        <Tags car={car} />
        <div className="cstats">
          <span><b>{car.specs.horsepower_hp}</b> hp</span>
          <span><b>{car.specs.weight_lbs.toLocaleString()}</b> lbs</span>
          <span><b>{car.specs.zero_to_sixty_s}</b>s 0-60</span>
        </div>
      </div>
    </Link>
  )
}
