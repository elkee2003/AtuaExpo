import { View, Text } from 'react-native'
import React, {useState, useContext, createContext} from 'react'

const AuthContext = createContext({})

const AuthProvider = ({children}) => {

    const [authUser, setAuthUser] = useState(null)
    const [dbUser, setDbUser] = useState(null)

    sub = null

  return (
    <AuthContext.Provider value={{authUser, dbUser, sub, setDbUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider

export const useAuthContext = ()=> useContext(AuthContext)