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
    noOrderFoundCon:{
        flex:1,
    }, 
    noOrderFound:{
        fontSize:30,
        fontWeight:'bold',
        color:'#acacac',
        textAlign:'center',
    },
    loading:{
        flex:1,
        color:'#3cff00',
        justifyContent:'center',
        alignItems:'center',
    },
})

export default styles
