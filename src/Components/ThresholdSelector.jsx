import { useState } from 'react'
import '../App.css'

function ThresholdSelector(props) {
    return (
        <div onChange={props.handleChange}>
            <div>
                <input type="radio" value={500} name="thresh" id="thresh1" disabled={props.isDisabled}/> 
                <label htmlFor="thresh1">Newcomer (500 words)</label>
            </div>
            <div>
                <input type="radio" value={3000} name="thresh" id="thresh2" disabled={props.isDisabled}/> 
                <label htmlFor="thresh2">Everyday Conversant Nonnative Speaker (3000 words)</label>
            </div>
            <div>
                <input type="radio" value={10000} name="thresh" id="thresh3" disabled={props.isDisabled}/>
                <label htmlFor="thresh3">Native Speaker (10,000 words)</label>
            </div>
            <div>
                <input type="radio" value={15000} name="thresh" id="thresh4" disabled={props.isDisabled}/>
                <label htmlFor="thresh4">Big Balling Speaker (15,000 words)</label>
            </div>
        </div>
    )
}

export default ThresholdSelector;