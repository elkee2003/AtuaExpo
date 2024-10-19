import { StyleSheet, } from 'react-native'

const styles = StyleSheet.create({
    container:{
        backgroundColor:'#3f3d3dd9',
        marginTop:20,
        marginHorizontal:10,
        padding:10,
        borderRadius:20,
        marginBottom:120,
    },
    mainHeader:{
        fontSize:21,
        color:'#ebe8e8',
        marginBottom:10,
        fontWeight:'bold',
    },
    header:{
        fontSize:17,
        fontWeight:'bold',
        color:'#ebe8e8',
        lineHeight:23,
        marginVertical:5
    },
    policy:{
        borderBottomWidth:1,
        borderColor:"#7e7d7d",
    },
    policyTxt:{
        color:'#ebe8e8',
        lineHeight:23,
        fontSize:15,
    },
    policyLastTxt:{
        marginTop:10,
        fontSize:15,
        fontStyle:'italic',
        color:'#ebe8e8',
        lineHeight:20,
    }
})

export default styles
