import { StyleSheet,} from 'react-native'

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:35,
        marginHorizontal:10,
    },
    header:{
        fontSize:30,
        fontWeight:'bold',
        textAlign:'center'
    },
    loading:{
        flex:1,
        color:'#3cff00',
        justifyContent:'center',
        alignItems:'center',
    },
    noOrdersCon:{
        flex:1, 
        justifyContent:'center', 
        alignItems:'center',
    },
    noOrders:{
        fontSize:30, 
        fontWeight:'bold', 
        color:'#afadad',
    }
})

export default styles
