import { View, Text } from 'react-native'
import React, {useState, useEffect, useContext, createContext} from 'react'

const OrderContext = createContext({})

const OrderProvider = ({children}) => {

    const [recipientName, setRecipientName]= useState('')
    const [recipientNumber, setRecipientNumber]= useState('')
    const [orderDetails, setOrderDetails]= useState('')
    const [transportationType, setTransportationType]= useState('')
    const [orders, setOrders]= useState('')
    const [price, setPrice] = useState('')
    const [courierFee, setCourierFee] = useState(null)

    const removeOrder = []

    const createOrder = []

  return (
    <OrderContext.Provider value={{recipientName, recipientNumber, orderDetails, setRecipientName, setRecipientNumber, setOrderDetails, transportationType, setTransportationType, orders, setOrders,price, setPrice, courierFee, setCourierFee, removeOrder, createOrder}}>
        {children}
    </OrderContext.Provider>
  )
}

export default OrderProvider

export const useOrderContext = ()=> useContext(OrderContext)