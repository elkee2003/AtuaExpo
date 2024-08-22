import { View, Text } from 'react-native'
import React, {useState, useContext, createContext} from 'react'

const OrderContext = createContext({})

const OrderProvider = ({children}) => {

    const [recipientName, setRecipientName]= useState('')
    const [recipientNumber, setRecipientNumber]= useState('')
    const [orderDetails, setOrderDetails]= useState('')
    const [orders, setOrders]= useState([])

    const removeOrder = []

    const createOrder = []

  return (
    <OrderContext.Provider value={{recipientName, recipientNumber, orderDetails, setRecipientName, setRecipientNumber, setOrderDetails, orders, setOrders, removeOrder, createOrder}}>
        {children}
    </OrderContext.Provider>
  )
}

export default OrderProvider

export const useOrderContext = ()=> useContext(OrderContext)