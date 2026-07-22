import {AnimatePresence, motion} from "framer-motion";
import {useEffect, useState, useRef} from "react";
import Style from "./Dropdown.module.css"
import type { Variants } from "framer-motion";

const menuVariants: Variants = {
    hidden: {
        opacity: 0,
        y: -15,
        scale: 0.95,
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.2,
            ease: [0.16, 1, 0.3, 1],
        },
    },
    exit:{
        opacity: 0,
        y: -15,
        scale: 0.95,
        transition: {
            duration: 0.2,
            ease: [0.16, 1, 0.3, 1],
        },
    }
}

export default function Dropdown({options, defaultValue, onChange, textColor}:{options:string[], defaultValue:string, onChange:(option:string)=>void, textColor?:string}) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(defaultValue);
    const dropDownRef = useRef<HTMLDivElement | null>(null)

    useEffect(()=>{
        function clickOutside(event: MouseEvent){
            if(dropDownRef.current && event.target instanceof Node && !dropDownRef.current.contains(event.target))
                setOpen(false);
        }
        document.addEventListener("mousedown", clickOutside);
        return ()=>{
            document.removeEventListener("mousedown", clickOutside);
        }
    }, [])

    return(
        <div className={"relative w-full"} ref={dropDownRef}>
            <button className={Style.toggle} onClick={()=>setOpen(!open)}>
                <span style={textColor ?  {color:textColor} : {}}>{selected}</span>
                <motion.div
                    animate={{rotate: open ? 180 : 0}}
                    transition={{duration: 0.2}}
                >
                    <i className={"fa-solid fa-chevron-down"}/>
                </motion.div>
            </button>

            <AnimatePresence>
                {
                    open && (
                        <motion.ul className={Style.dropdownMenu} initial={"hidden"} animate={"visible"} exit={"exit"} variants={menuVariants}>
                            {options.map((option, index) => (
                                <motion.li key={index} onClick={()=>{
                                    setSelected(option);
                                    onChange(option);
                                    setOpen(false)
                                }}
                                >
                                    {option}
                                </motion.li>
                            ))}
                        </motion.ul>
                    )
                }
            </AnimatePresence>
        </div>
    )
}